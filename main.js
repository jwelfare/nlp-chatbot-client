/**
 * chatbot
 * Global JS
 *
 * version: 0.0.1
 * file:    global.js
 * author:  Squiz Australia + Squiz NZ
 * change log:
 *     Currently under production. Authors: Daniel Medyckyj-Scott & John Welfare
 */

'use strict';

/*global appData, dataLayer*/

/*
 * Chatbot App
 *
 *  Table of contents
 *      1. Variables
 *      2. Templates
 *      3. Helpers
 *      4. Build markup using templates
 *      5. Removed as no longer necessary
 *      6. API.AI
 *      7. Google analytics
 *      8. Button actions
 *      9. Bind buttons
 *		10. Update focusable elements
 *		11. Bind keyboard actions
 *		12. Animations
 *      13. Mobile behaviour
 *      14. Init the App
 *      15. Build the App
 *   
*/

var chatbotApp = {

    // 1. Variables
    enabled: {
        GTM: true, // disable or enable the analytics - mostly for DEV
        textInput: true // disable or enable text input
    },
    mobile: {
        start: 600, // Mobile breakpoint (in px)
        hideClass: 'chatbot-off', // Elements to hide when chatbot is opened
        behaviourOn: false, // Flag to run mobileBehaviour() only once
        behaviourDebouncer: undefined // mobileBehaviour() debouncer
    },
    session: undefined, //cookie session variable
    currentLang: undefined, // Curent language
    currentResponse: {}, // Placeholder for current response
    GTM: {
        eventName: 'GAEvent', // custom event name set in GTM
        referrerURL: window.location !== window.parent.location ? document.referrer : document.location.href,
        currentEventValue: undefined,
        currentEventLabel: undefined,
        currentEventAction: undefined
    },
    focusElements: { // Tracks the first and last focusable elements for accessible focus trapping
    	first: undefined,
    	last: undefined
    },
    XHR: new XMLHttpRequest(), // hold the xhr in upper scope

    // 2. Templates
    // Uses Handlebar.js for templating. Templates stored in handlebars-templates.js file  (#236634).
    templates: function templates(data, name) {
        var handlebarTemplate = '',
            templateInfo = {},
            template = '',
            _this = this;

        // App structure
        if (name === 'app') {
            
            handlebarTemplate = Handlebars.templates['template-app'];
            
            templateInfo = {
                title: data.appName,
                closeText: data.closeText,
                inputText:data.placeholderText
            };
            
            template = handlebarTemplate(templateInfo); 
    
        //Welcome message template.    
        }else if(name === 'welcomeMessage'){
            
            handlebarTemplate = Handlebars.templates['template-welcomeMessage'];
            
            templateInfo = {
                welcomeMessage: data.entryPointNLP
            }
            
            template = handlebarTemplate(templateInfo);
            
        // Answer template
        } else if (name === 'answer') {
            
            var answersAsButtons = data.show_answers ? true : false, //true when there are button answers to show
                answers = data.answers ? data.answers : [],
                hasAnswers = data.answers ? true : false
            
            // Adds start over button to helper buttons when a user interacts when chatbot.
            document.getElementById('helper-buttons-section').innerHTML = '<button class="chatbot-header--startover chatbot-startover--js"> Start Over </button>  <form target="_blank"> <button formaction="https://www.timaru.govt.nz/tim-the-chatbot-help" class="chatbot-header--help"> Help </button></form>';
            
            // true if answers are to be clickable (either links or buttons that send action to DialogFlow)
            if(answersAsButtons){
                
                if (hasAnswers) {
                    
                    answers.map(function (item) {
                        
                        // true if answer is a link
                        if(item.is_link) {
                            
                            handlebarTemplate = Handlebars.templates['template-answerButtonsLink'];
            
                            templateInfo = {
                                linkTitle: item.display_name,
                                link: item.is_link
                            }
                            
                            template = handlebarTemplate(templateInfo);
                            
                        }else {
                            //answers are buttons linked to dialogflow
                            
                            handlebarTemplate = Handlebars.templates['template-answerButtonsDialogFlow'];
            
                            templateInfo = {
                                isDialogFlowAction: item.is_dialogflow_action,
                                dialogFlowAnswer: item.display_name
                            }
                            
                            template = handlebarTemplate(templateInfo);

                        }
                    });
                }
            }else{
                //answers are just text
                
                handlebarTemplate = Handlebars.templates['template-answerText'];
            
                templateInfo = {
                    answer: data.content
                }
                
                template = handlebarTemplate(templateInfo);
                
            }
        

        // Question template
        } else if (name === 'question') {
           
            handlebarTemplate = Handlebars.templates['template-question'];
            
            templateInfo = {
                question: data.content
            }
            
            template = handlebarTemplate(templateInfo);
            
        }

        return template;
    },

    // 3. Helpers
    helpers: {
        
    // 	// Strip protocol and domain from URL
    //     stripURL: function stripURL(url) {
    //         var path = url;

    //         path = path.replace('https://', '').replace('http://', ''); // remove protocol
    //         path = path.substr(path.indexOf('/') + 1); // strip domain

    //         return path;
    //     },

        // Loader for loading bubbles functionality
        loader: function loader(status) {
            if (status) {
                document.querySelector('div.chatbot-speech-loader--js').classList.remove('chatbot-speech-loader--hidden');
            } else {
                
                document.querySelector('div.chatbot-speech-loader--js').classList.add('chatbot-speech-loader--hidden');
            }
        },

        // Insert element before
        insertBefore: function insertBefore(el, referenceNode) {
            referenceNode.parentNode.insertBefore(el, referenceNode);
        },

        // Scroll to the bottom of the chat
        scrollToBottom: function scrollToBottom() {
            var chatWindow = document.getElementsByClassName('chatbot-main--js')[0];
            chatWindow.scrollTop = chatWindow.scrollHeight;
        },

        // Handle XHR error - TODO!
        xhrErrorHandler: function xhrErrorHandler() {
            console.log('Error - XHR');
        },

        //clear out the window
        clearWindow: function clearWindow() {
            
            document.querySelector('.chatbot-window--js').innerHTML = '<div class="chatbot-speech-loader chatbot-speech-loader--js">\n                                <p>\n                                    <span class="bubblingG">\n                                        <span id="bubblingG_1"></span>\n                                        <span id="bubblingG_2"></span>\n                                        <span id="bubblingG_3"></span>\n                                    </span>\n                                </p>\n                            </div>';
            
        }
  
    },

    // 4. Build markup using templates
    printResponse: function printResponse(data, template) {
        var _this = this,
            html = _this.templates(data, template),
            tempDiv = document.createElement('div'),
            loader = document.querySelector('div.chatbot-speech-loader--js');

        // Hide loader
        _this.helpers.loader(false);

        // Append template to temp div
        tempDiv.innerHTML = html;

        // Get node that should accually get appended before the loader
        var toAppend = tempDiv.firstChild;

		// Append response
        _this.helpers.insertBefore(toAppend, loader);

        // Set focus to response
        toAppend.focus();

        // Rebind button actions
        _this.bindButtons();

        // Update focusable elements
        _this.updateFocusElements();
    },

    // 6. API.AI
    apiai: function apiai() {
        var _context = this;
        var methods = {

            // Send question to gateway
            sendText: function sendText(text) {
                var _this = this;

                // Rewrite the XHR var
                _context.XHR = new XMLHttpRequest();

                // State changed
                _context.XHR.onreadystatechange = function () {

                    // No errors
                    if (_context.XHR.readyState === 4 && _context.XHR.status === 200) {
                        var response = JSON.parse(_context.XHR.responseText);
                        console.log(response); 
                        // Process the API.AI response
                        _this.processResponse(response);
                    };
                };

                // Make the call
                _context.XHR.open('get', appData[_context.currentLang].apiaiGateway + '?query=' + encodeURIComponent(text) +'&session='+_context.session);
                _context.XHR.send();
            },

            // Process gateway response
            processResponse: function processResponse(response) {
                
                
                var action = response.queryResult.action !== 'input.unknown' ? response.queryResult.action : undefined;
                
                var payload = response.queryResult.webhookPayload || {};
                
                // Get response from API.AI speech
                var questionAnswer = { 
                    'content': '<p>' + response.queryResult.fulfillmentText + '<\/p>',
                };

                //was used for opening link automatically - probably not a good user experience. 
                // if(payload.hasOwnProperty('autoOpenUrl')){
                //     var link = payload.autoOpenUrl;
                //     var win = window.open(link, '_blank');
                //     win.focus();
                // }

                if(payload.hasOwnProperty('answers')) {
                    questionAnswer.answers = payload["answers"];
                    questionAnswer.show_answers = true;
                }

                // Print the response
                _context.printResponse(questionAnswer, 'answer');

                // Scroll to it
                _context.helpers.scrollToBottom();
                    
                //focus back on input
                document.querySelector('.chatbot-input--js').focus();
                

            }
        };

        return methods;
    },

    // 8. Button actions
    elementActions: function elementActions() {
        var _context = this;

        var actions = {

            // Answer action
            answerAction: function answerAction(e) {
                e.preventDefault();

                // Print picked option
                var questionResponse = { 
                	'content': e.target.innerHTML,
            	};
                
                // Hide previous go back links
                _context.helpers.clearBackLinks();

                // Print response to chatbot window
                _context.printResponse(questionResponse, 'question');

                // Show loader
                _context.helpers.loader(true);

                // Scroll to that option
                _context.helpers.scrollToBottom();

                // Get response data
                if (e.target.dataset["dialogflowAction"] === "true") {
                    //_context.apiai().sendText(questionResponse.content);
                    //Send selected contextual navigation value to funnelback search results page
                    window.location.href = '/search-results?query=' + encodeURI(e.target.innerHTML);
                    
                } 
            },

            // Quit actions
            quitAction: function quitAction(e) {
                e.preventDefault();

                // Hide
                document.querySelector('.chatbot--js').classList.remove('chatbot--on');

                // Set ARIA hidden to true
                document.querySelector('.chatbot-wrapper--js').setAttribute("aria-hidden", true);

                // Mobile behaviour
                _context.mobileBehaviour();

                // Clear wrapper html
                setTimeout(function () {
                    document.querySelector('.chatbot-wrapper--js').innerHTML = '';
                    
                    // Add class to body
                    document.querySelector('body').classList.remove('chatbot-on');
                    
                    // Reshow buttons
                    var createButtons = document.querySelectorAll('.chatbot-create--js');

                    for (var c = 0; c < createButtons.length; c++) {
                    	createButtons[c].classList.remove('chatbot-create--off');
                    	createButtons[c].setAttribute('aria-hidden', false);
                	}
                }, 750);
            },

            // Text input action
            textInput: function textInput(e) {
                
                console.log("dadsa");
                e.preventDefault();

                // Print picked option
                var questionResponse = { 'content': document.getElementsByClassName('chatbot-input--js')[0].value };
                
                _context.printResponse(questionResponse, 'question');
                
                // Show loader
                _context.helpers.loader(true);
                

                // Scroll to what was typed in the chat window
                _context.helpers.scrollToBottom();

                // Send question to API.AI
                _context.apiai().sendText(document.getElementsByClassName('chatbot-input--js')[0].value);

                // Clear the input
                document.querySelector('.chatbot-input--js').value = '';
            },

            startoverAction: function startoverAction(e){
                
                // Create new session
                var createSession = function() {
                    return 'id-' + Math.random().toString(36).substr(2, 16);
                };
                chatbotApp.session = createSession();
                
                // Clear the window
                _context.helpers.clearWindow();
                
                //Print welcome message into chatbot
                _context.printResponse(appData[_context.currentLang], "welcomeMessage"); 
                
                // Initiliase chatbot
                _context.init(_context.currentLang);
          
                // Remove Startover button from helper buttons
                document.getElementById('helper-buttons-section').innerHTML = '<form target="_blank"> <button formaction="https://www.timaru.govt.nz/tim-the-chatbot-help" class="chatbot-header--help"> Help </button></form>';
                
            }
            
           
        };

        return actions;
    },

    // 9. Bind buttons
    bindButtons: function bindButtons() {
        var _this = this;

        // Handle events
        _this.handleEvent = function (e) {

            // Answer button
            if (e.target.classList.contains('chatbot-answers-link--js')) {
                _this.elementActions().answerAction(e);

            // Direct text input
            } else if (e.target.classList.contains('chatbot-ask-form--js')) {
                console.log('surely');
                _this.elementActions().textInput(e);

            // Quit button
            } else if (e.target.classList.contains('chatbot-quit-link--js')) {
                _this.elementActions().quitAction(e);
            
            // Startover button
            }else if (e.target.classList.contains('chatbot-startover--js')){
                _this.elementActions().startoverAction(e);
            
            // Help button   
            }else if (e.target.classList.contains('chatbot-help-link--js')){
                _this.elementActions().helpAction(e);
            }
        };

        // Answer button
        if (document.getElementsByClassName('chatbot-answers-link--js').length) {
            for (var i = 0; i < document.getElementsByClassName('chatbot-answers-link--js').length; i += 1) {
                document.getElementsByClassName('chatbot-answers-link--js')[i].removeEventListener('click', _this, false);
                document.getElementsByClassName('chatbot-answers-link--js')[i].addEventListener('click', _this, false);
            }
        }

        // Quit button
        if (document.getElementsByClassName('chatbot-quit-link--js').length) {
            for (var j = 0; j < document.getElementsByClassName('chatbot-quit-link--js').length; j += 1) {
                document.getElementsByClassName('chatbot-quit-link--js')[j].removeEventListener('click', _this, false);
                document.getElementsByClassName('chatbot-quit-link--js')[j].addEventListener('click', _this, false);
            }
        }

        // Ask form submit
        if (document.getElementsByClassName('chatbot-ask-form--js').length && _this.enabled.textInput) {
            document.getElementsByClassName('chatbot-ask-form--js')[0].removeEventListener('submit', _this, false);
            document.getElementsByClassName('chatbot-ask-form--js')[0].addEventListener('submit', _this, false);
        }

        // start over button
        if (document.getElementsByClassName('chatbot-startover--js').length) {
        	for (var j = 0; j < document.getElementsByClassName('chatbot-startover--js').length; j += 1) {
        		document.getElementsByClassName('chatbot-startover--js')[j].removeEventListener('click', _this, false);
        		document.getElementsByClassName('chatbot-startover--js')[j].addEventListener('click', _this, false);
        	}
        }
        
        // help button
        if (document.getElementsByClassName('chatbot-help-link--js').length) {
        	for (var j = 0; j < document.getElementsByClassName('chatbot-help-link--js').length; j += 1) {
        		document.getElementsByClassName('chatbot-help-link--js')[j].removeEventListener('click', _this, false);
        		document.getElementsByClassName('chatbot-help-link--js')[j].addEventListener('click', _this, false);
        	}
        }
        
    },

    // 10. Update Focusable Elements
    updateFocusElements: function updateFocusElements() {
		var _this = this,
			wrapper = document.querySelector('.chatbot-wrapper--js'),
			focusSelectors = ['input', 'a[href]', 'button', '[tabindex]'],
			candidates = wrapper.querySelectorAll(focusSelectors);

		_this.focusElements.first = candidates[0];
		_this.focusElements.last = candidates[candidates.length - 1];
    },

    // 11. Bind Keyboard Actions
    bindKeyboardActions: function bindKeyboardActions() {
    	var _this = this, 
    	wrapper = document.querySelector('.chatbot-wrapper--js');

    	wrapper.addEventListener('keydown', function(e) {
    		if (e.keyCode === 9 && !e.shiftKey) { // tab
    			if(e.target === _this.focusElements.last) {
    				e.preventDefault();

    				_this.focusElements.first.focus();
    			}
    		} 

    		if (e.keyCode === 9 && e.shiftKey) { // shift + tab
				if(e.target === _this.focusElements.first) {
					e.preventDefault();
					
					_this.focusElements.last.focus();
				}
    		}

    		if (e.keyCode === 27) { //escape
    			_this.elementActions().quitAction(e);
    		}
    	});
    },

    // 13. Mobile behaviour
    mobileBehaviour: function mobileBehaviour() {
        var _this = this;

        // Act on resize
        clearTimeout(_this.mobile.behaviourDebouncer);

        _this.mobile.behaviourDebouncer = setTimeout(function () {
            if (window.innerWidth < _this.mobile.start) {
                document.querySelector('.chatbot-wrapper--js').style.width = window.innerWidth + 'px';
                document.querySelector('.chatbot-wrapper--js').style.height = window.innerHeight + 'px';

                // Hide elements on mobile when opened
                if (document.getElementsByClassName(_this.mobile.hideClass).length && document.getElementsByClassName('chatbot-on').length) {
                    for (var i = 0; i < document.getElementsByClassName(_this.mobile.hideClass).length; i += 1) {
                        document.getElementsByClassName(_this.mobile.hideClass)[i].style.display = 'none';
                    }

                    // Show elements on mobile when closed
                } else {
                    for (var j = 0; j < document.getElementsByClassName(_this.mobile.hideClass).length; j += 1) {
                        document.getElementsByClassName(_this.mobile.hideClass)[j].style.display = '';
                    }
                }
            } else {
                document.querySelector('.chatbot-wrapper--js').style.width = '';
                document.querySelector('.chatbot-wrapper--js').style.height = '';

                // Show elements off mobile
                if (document.getElementsByClassName(_this.mobile.hideClass).length) {
                    for (var k = 0; k < document.getElementsByClassName(_this.mobile.hideClass).length; k += 1) {
                        document.getElementsByClassName(_this.mobile.hideClass)[k].style.display = '';
                    }
                }
            }
        }, 50);

        // Fire only once
        if (!_this.mobile.behaviourOn) {

            // Set the flag
            _this.mobile.behaviourOn = true;

            // On resize
            window.onresize = function () {
                _this.mobileBehaviour();
            };

            // On orientation change
            window.addEventListener('orientationchange', function () {
                _this.mobileBehaviour();
            }, false);
        }
    },

    // 14. Init the App
    init: function init() {
        var _this = this;

        // Rebuild button actions
        _this.bindButtons();

    },

    // 15. Build the App
    build: function build(wrapper, lang) {
        var _this = this;

        // Test flexbox support
        var d = document.documentElement.style;
        if ('flexWrap' in d || 'WebkitFlexWrap' in d || 'msFlexWrap' in d) {
            document.querySelector('html').classList.add('flexbox');
        }

        // Test SVG support
        if (document.implementation.hasFeature('http://www.w3.org/TR/SVG11/feature#Shape', '1.0')) {
            document.querySelector('html').classList.add('svg');
        }

        // Build app structure
        document.getElementsByClassName(wrapper)[0].innerHTML = _this.templates(appData[lang], 'app');
        
        //Print welcome message into chatbot
        _this.printResponse(appData[lang], "welcomeMessage"); 

        // Bind buttons
        _this.bindButtons();

        // Bind keyboard actions
        _this.bindKeyboardActions();

        // Assign an universal handler for XHR errors
        _this.XHR.onerror = function () {
            _this.helpers.xhrErrorHandler();
        };

        // Sat current lang
        _this.currentLang = lang;

        // Init the app with a given lang
        _this.init(_this.currentLang);

        // Add class to body
        document.querySelector('body').classList.add('chatbot-on');
        
        // Set ARIA hidden to false
        document.getElementsByClassName(wrapper)[0].setAttribute("aria-hidden", false);

        // Handle mobile behaviour
        _this.mobileBehaviour();

        // Slide chatobot in
        setTimeout(function () {
            document.querySelector('.chatbot--js').classList.add('chatbot--on');
        }, 100);
    }

};

/*global chatbotApp*/
document.addEventListener('DOMContentLoaded', function () {

    // Create the chatbot on button click
    var createButtons = document.querySelectorAll('.chatbot-create--js');
   
   //Create random session id each time chatbot is built
   var createSession = function() {
        return 'id-' + Math.random().toString(36).substr(2, 16);
    };
    chatbotApp.session = createSession();

    for (var c = 0; c < createButtons.length; c++) {
    	createButtons[c].addEventListener('click', function (e) {
	        // Build the app
	        if (e.target.dataset.lang) {
	            chatbotApp.build('chatbot-wrapper--js', e.target.dataset.lang);
	        } else {
	            chatbotApp.build('chatbot-wrapper--js', e.target.parentNode.dataset.lang); // Chrome fix
	        }

	       	// Hide all buttons on click
	       	for (var c = 0; c < createButtons.length; c++) {
        		createButtons[c].classList.add('chatbot-create--off');
        		createButtons[c].setAttribute("aria-hidden", true);	
	       	}
        }, false)
    }
}, false);
