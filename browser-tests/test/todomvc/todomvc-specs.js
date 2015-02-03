'use strict';

var fs = require('fs');
var rootUrl = 'http://localhost:8000';

var wd = require('wd');
var keys = wd.SPECIAL_KEYS;
require('colors');
var _ = require("lodash");
var chai = require("chai");
var chaiAsPromised = require("chai-as-promised");

var createTodoPage = require("./todoPage");

chai.use(chaiAsPromised);
chai.should();
chaiAsPromised.transferPromiseness = wd.transferPromiseness;

var sauce = true;
// checking sauce credential
if(!process.env.SAUCE_USERNAME || !process.env.SAUCE_ACCESS_KEY){
  console.warn(
    '\nNot using sauce, if you want to use sauce configure your sauce credential as follows:\n\n' +
    'export SAUCE_USERNAME=<SAUCE_USERNAME>\n' +
    'export SAUCE_ACCESS_KEY=<SAUCE_ACCESS_KEY>\n\n'
  );
  sauce = false;
  //    throw new Error("Missing sauce credentials");
}

// http configuration, not needed for simple runs
wd.configureHttp( {
  timeout: 60000,
  retryDelay: 15000,
  retries: 5
});

var desired = JSON.parse(process.env.DESIRED || '{browserName: "chrome"}');
desired.name = 'todomvc-specs ' + desired.browserName;
desired.tags = ['maquette'];
if(process.env.TRAVIS_BUILD_NUMBER) {
  desired.tags.push("build-" + process.env.TRAVIS_BUILD_NUMBER);
}

describe('todomvc-maquette (' + desired.browserName + ')', function() {
  var browser;
  var page;
  var allPassed = true;

  before(function (done) {
    if(sauce) {
      var username = process.env.SAUCE_USERNAME;
      var accessKey = process.env.SAUCE_ACCESS_KEY;
      browser = wd.promiseChainRemote("localhost", 4445, username, accessKey);
    } else {
      browser = wd.promiseChainRemote("localhost", 4444, username, accessKey);
    }
    if (true || process.env.VERBOSE) {
      // optional logging     
      browser.on('status', function(info) {
        console.log(info.cyan);
      });
      browser.on('command', function(meth, path, data) {
        console.log(' > ' + meth.yellow, path.grey, data || '');
      });            
    }
    browser
      .init(desired)
      .setAsyncScriptTimeout(3000)
      .then(function () {
        // Hack needed for sauce on windows
//      require('dns').lookup(require('os').hostname(), function (err, add, fam) {
//        console.log('local ip: ' + add);
//        rootUrl = rootUrl.replace("localhost", add);
          page = createTodoPage(browser, browser.get(rootUrl + "/examples/todomvc/index.html"));
          done();
//        });
      });
  });

  beforeEach(function (done) {
    browser.get(rootUrl + "/examples/todomvc/index.html").then(function () { done(); });
  });

  afterEach(function(done) {
    allPassed = allPassed && (this.currentTest.state === 'passed');
    browser.safeExecute('window.localStorage["todomvc-maquette"]=""')
      .then(function () { done(); });
  });

  after(function(done) {
    browser = browser.quit();
    if(sauce) {
      browser = browser.sauceJobStatus(allPassed);
    }
    browser.nodeify(done);
  });

  // The tests

  var TODO_ITEM_ONE = 'buy some cheese';
  var TODO_ITEM_TWO = 'feed the cat';
  var TODO_ITEM_THREE = 'book a doctors appointment';

  if(desired.browserName === "internet explorer") {
    TODO_ITEM_ONE = "1";
    TODO_ITEM_TWO = "2";
    TODO_ITEM_THREE = "3";
  }

  var createStandardItems = function () {
    return page
      .enterItem(TODO_ITEM_ONE)
      .enterItem(TODO_ITEM_TWO)
      .enterItem(TODO_ITEM_THREE);
  };

  describe('When page is initially opened', function () {
  	it('should focus on the todo input field', function () {
  	  return page.assertFocussedElementId("new-todo");
	  });
  });
  
  describe('No Todos', function () {
  	it('should hide #main and #footer', function () {
  	  return page
        .assertItems([])
  		  .assertMainSectionIsHidden()
  		  .assertFooterIsHidden();
  	});
  });

  describe('New Todo', function () {
    it('should allow me to add todo items', function () {
      return page
        .enterItem(TODO_ITEM_ONE)
        .assertItems([TODO_ITEM_ONE])
        .enterItem(TODO_ITEM_TWO)
        .assertItems([TODO_ITEM_ONE, TODO_ITEM_TWO]);
    });

    it('should clear text input field when an item is added', function () {
      return page
        .enterItem(TODO_ITEM_ONE)
        .assertItemInputFieldText('');
    });

    it('should append new items to the bottom of the list', function () {
      createStandardItems();
      return page
        .assertItems([TODO_ITEM_ONE, TODO_ITEM_TWO, TODO_ITEM_THREE]);
    });

    it('should trim text input', function () {
      return page
        .enterItem('   ' + TODO_ITEM_ONE + '  ')
        .assertItems([TODO_ITEM_ONE]);
    });

    it('should show #main and #footer when items added', function () {
      return page
        .enterItem(TODO_ITEM_ONE)
        .waitForAnimationFrame()
        .assertMainSectionIsVisible()
        .assertFooterIsVisible();
    });
  });

  describe('Mark all as completed', function () {
    it('should allow me to mark all items as completed', function () {
      createStandardItems();
      return page
        .clickMarkAllCompletedCheckBox()
        .assertItemsToBeCompleted([true, true, true]);
    });

    it('should allow me to clear the completion state of all items', function () {
      createStandardItems();
      return page
        .clickMarkAllCompletedCheckBox()
        .clickMarkAllCompletedCheckBox()
        .assertItemsToBeCompleted([false, false, false]);
    });

    it('complete all checkbox should update state when items are completed / cleared', function () {
      createStandardItems();
      return page
        .clickMarkAllCompletedCheckBox()
        .waitForAnimationFrame()
        .assertCompleteAllIsChecked()
        .toggleItemAtIndex(0)
        .waitForAnimationFrame()
        .assertCompleteAllIsClear()
        // now mark as complete, so that once again all items are completed
        .toggleItemAtIndex(0)
        .waitForAnimationFrame()
        .assertCompleteAllIsChecked();
    });
  });

  describe('Item', function () {
    it('should allow me to mark items as complete', function () {
      return page
        .enterItem(TODO_ITEM_ONE)
        .enterItem(TODO_ITEM_TWO)
        .toggleItemAtIndex(0)
        .waitForAnimationFrame()
        .assertItemsToBeCompleted([true, false])
        .toggleItemAtIndex(1)
        .waitForAnimationFrame()
        .assertItemsToBeCompleted([true, true]);
    });

    it('should allow me to un-mark items as complete', function () {
      return page
        .enterItem(TODO_ITEM_ONE)
        .enterItem(TODO_ITEM_TWO)
        .toggleItemAtIndex(0)
        .waitForAnimationFrame()
        .assertItemsToBeCompleted([true, false])
        .toggleItemAtIndex(0)
        .waitForAnimationFrame()
        .assertItemsToBeCompleted([false, false]);
    });

    it('should allow me to edit an item', function () {
      createStandardItems();
      return page
        .doubleClickItemAtIndex(1)
        .waitForAnimationFrame()
        .editItem('buy some sausages' + keys.Enter)
        .waitForAnimationFrame()
        .assertItems([TODO_ITEM_ONE, 'buy some sausages', TODO_ITEM_THREE]);
    });
  });

  describe('Editing', function () {
    it('should hide other controls when editing', function () {
      keys.Enter.should.equal('\uE007');
      createStandardItems();
      return page
        .doubleClickItemAtIndex(1)
        .waitForAnimationFrame()
        .assertItemToggleIsHidden(1)
        .assertItemLabelIsHidden(1);
    });

    it('should save edits on enter', function () {
      createStandardItems();
      return page
        .doubleClickItemAtIndex(1)
        .waitForAnimationFrame()
        .editItem('buy some sausages' + keys.Enter)
        .waitForAnimationFrame()
        .assertItems([TODO_ITEM_ONE, 'buy some sausages', TODO_ITEM_THREE]);
    });

    it('should save edits on blur', function () {
      createStandardItems();
      return page
        .doubleClickItemAtIndex(1)
        .waitForAnimationFrame()
        .editItem('buy some sausages')
        .waitForAnimationFrame()
        .toggleItemAtIndex(0)
        .waitForAnimationFrame()
        .assertItems([TODO_ITEM_ONE, 'buy some sausages', TODO_ITEM_THREE]);
    });

    it('should trim entered text', function () {
      createStandardItems();
      return page
        .doubleClickItemAtIndex(1)
        .waitForAnimationFrame()
        .editItem('    buy some sausages  ' + keys.Enter)
        .waitForAnimationFrame()
        .assertItems([TODO_ITEM_ONE, 'buy some sausages', TODO_ITEM_THREE]);
    });

    it('should remove the item if an empty text string was entered', function () {
      createStandardItems();
      return page
        .doubleClickItemAtIndex(1)
        .waitForAnimationFrame()
        .editItem(keys.Delete)
        .editItem(keys.Enter)
        .waitForAnimationFrame()
        .assertItems([TODO_ITEM_ONE, TODO_ITEM_THREE]);
    });

    it('should cancel edits on escape', function () {
      createStandardItems();
      return page
        .doubleClickItemAtIndex(1)
        .waitForAnimationFrame()
        .editItem('foo' + keys.Escape)
        .waitForAnimationFrame()
        .assertItems([TODO_ITEM_ONE, TODO_ITEM_TWO, TODO_ITEM_THREE]);
    });
  });

  describe('Counter', function () {
    it('should display the current number of todo items', function () {
      return page
        .enterItem(TODO_ITEM_ONE)
        .assertItemCountText('1 item left')
        .enterItem(TODO_ITEM_TWO)
        .assertItemCountText('2 items left');
    });
  });

  describe('Clear completed button', function () {
    it('should display the number of completed items', function () {
      createStandardItems();
      return page
        .toggleItemAtIndex(1)
        .waitForAnimationFrame()
        .assertClearCompleteButtonText('Clear completed (1)')
        .toggleItemAtIndex(2)
        .waitForAnimationFrame()
        .assertClearCompleteButtonText('Clear completed (2)');
    });

    it('should remove completed items when clicked', function () {
      createStandardItems();
      return page
        .toggleItemAtIndex(1)
        .waitForAnimationFrame()
        .clickClearCompleteButton()
        .waitForAnimationFrame()
        .assertItems([TODO_ITEM_ONE, TODO_ITEM_THREE]);
    });

    it('should be hidden when there are no items that are completed', function () {
      createStandardItems();
      return page
        .toggleItemAtIndex(1)
        .waitForAnimationFrame()
        .assertClearCompleteButtonIsVisible()
        .clickClearCompleteButton()
        .waitForAnimationFrame()
        .assertClearCompleteButtonIsHidden();
    });
  });

  describe('Routing', function () {
    it('should allow me to display active items', function () {
      createStandardItems();
      return page
        .toggleItemAtIndex(1)
        .waitForAnimationFrame()
        .filterByActiveItems()
        .waitForAnimationFrame()
        .assertItems([TODO_ITEM_ONE, TODO_ITEM_THREE]);
    });

    it('should respect the back button', function () {
      createStandardItems();
      return page
        .toggleItemAtIndex(1)
        .waitForAnimationFrame()
        .filterByActiveItems()
        .waitForAnimationFrame()
        .filterByCompletedItems()
        .waitForAnimationFrame()
        .assertItems([TODO_ITEM_TWO])
        .back()
        .waitForAnimationFrame()
        .assertItems([TODO_ITEM_ONE, TODO_ITEM_THREE])
        .back()
        .waitForAnimationFrame()
        .assertItems([TODO_ITEM_ONE, TODO_ITEM_TWO, TODO_ITEM_THREE]);
    });

    it('should allow me to display completed items', function () {
      createStandardItems();
      return page
        .toggleItemAtIndex(1)
        .waitForAnimationFrame()
        .filterByCompletedItems()
        .waitForAnimationFrame()
        .assertItems([TODO_ITEM_TWO]);
    });

    it('should allow me to display all items', function () {
      createStandardItems();
      return page
        .toggleItemAtIndex(1)
        .waitForAnimationFrame()
        .filterByActiveItems()
        .waitForAnimationFrame()
        .filterByCompletedItems()
        .waitForAnimationFrame()
        .filterByAllItems()
        .waitForAnimationFrame()
        .assertItems([TODO_ITEM_ONE, TODO_ITEM_TWO, TODO_ITEM_THREE]);
    });

    it('should highlight the currently applied filter', function () {
      createStandardItems();
      return page
        // initially 'all' should be selected
        .assertFilterAtIndexIsSelected(0)
        .filterByActiveItems()
        .waitForAnimationFrame()
        .assertFilterAtIndexIsSelected(1)
        .filterByCompletedItems()
        .waitForAnimationFrame()
        .assertFilterAtIndexIsSelected(2);
    });
  });

});
