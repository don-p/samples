'use strict';

/* App Module */

var meetingApp = angular.module('meetingApp', [
    'ui.router',
    'ui.bootstrap',
    'textAngular',
    'meetingControllers',
    'meetingFilters',
    'meetingServices',
    'ngDragDrop',
    'checklist-model'
 ]);

/*
 * JavaScript application constants service, can be injected where needed.
 */
//Application-scoped objects. //TODO: should be provided via a RESTful service.
meetingApp.constant('Constants',
	{
	meeting: {
		attendeeIcon: {
			background: {
	    		1:'#046c9f',
	    		2:'#06a7fa',
	    		3:'#c6c56a',
	    		4:'#9f5702',
	    		5:'#92278f',
	    		6:'#e33ddd',
	    		7:'#896492',
	    		8:'#ff6600',
	    		9:'#8dc53e',
	    		10:'#cb5100',
	    		11:'#659900',
	    		12:'#ff7a7a',
	    		13:'#bd1e2c',
	    		14:'#1db2b7',
	    		15:'#9f9741',
	    		16:'#009b83',
	    		17:'#4b54be',
	    		18:'#7e1bbc',
	    		19:'#4dc35b',
	    		20:'#1000e6',
	    		21:'#ed2a7a',
	    		22:'#990040',
	    		23:'#e62929',
	    		24:'#84a4ff',
	    		25:'#676668'
			}
		},
		event: {
			MEETING_UPDATE:		'meetingUpdate',
			NOTE_UPDATE: 		'noteUpdate',
			TOPIC_SELECTION: 	'topicSelection',
			TOPIC_POSTPONED: 	'topicPostponed',
			TOPIC_UPDATE:		'topicUpdate',
			ACTION_UPDATE: 		'actionUpdate',
			ACTION_DELETE: 		'actionDelete',
			DECISION_UPDATE: 	'decisionUpdate',
			DECISION_DELETE: 	'decisionDelete',
			AGENDA_UPDATE: 		'agendaUpdate',
			WEBSOCKET_CONNECT:	'websocket_connect',
			TIME_UPDATE:		'timeUpdate'
		},
        actionStatus: {
            NOT_ASSIGNED: "NOT_ASSIGNED",
            ASSIGNED: "ASSIGNED",
            ACCEPTED: "ACCEPTED",
            COMPLETE: "COMPLETE",
            DECLINED: "DECLINED",
            CANCELLED: "CANCELLED"
        },
        actionBadge: {
            NEW: "NEW",
            PENDING: "PENDING",
            ACCEPTED: "ACCEPTED",
            DECLINED: "DECLINED"
        },
        purposeOptions: [
            {name: "Decide", value: "Decide"},
            {name: "Plan", value: "Plan"},
            {name: "Brainstorm", value: "Brainstorm"},
            {name: "Review", value: "Review"},
            {name: "Build a relationship", value: "Build relationship"},
            {name: "Inform", value: "Inform"},
            {name: "Sell", value: "Sell"},
            {name: "Other", value: "Other"}
        ],
        resultOptions: [
            {name: "Verbal update", value: "Verbal update"},
            {name: "PowerPoint presentation", value: "PowerPoint presentation"},
            {name: "Spreadsheet", value: "Spreadsheet"},
            {name: "Printed report", value: "Printed report"},
            {name: "Online doc", value: "Online doc"},
            {name: "Video presentation", value: "Video presentation"},
            {name: "Graphic/Chart", value: "Graphic/Chart"},
            {name: "Other", value: "Other"}
        ],
        purposeMethod: {
        	decide: {
        		individual: 'Individual',
        		consensus: 'Consensus through dialogue',
        		unanimous: 'Unanimous vote',
        		majority: 'Majority vote'
        	},
        	plan: {
        		discuss:'Discuss approach',
        		goals:'Set goals',
        		strategy:'Define strategy',
        		actions:'Generate actions and tactics',
        		other:'Other'
        	},
        	brainstorm: {
        		generate: 'Generate ideas',
        		refine: 'Refine ideas',
        		solutions: 'Choose solutions',
        		solve: 'Solve a problem'
        	},
        	review: {
        		process: 'Process',
        		project: 'Project',
        		performance: 'Performance',
        		product: 'Product',
        		contract: 'Contract',
        		proposal: 'Proposal',
        		other: 'Other'
        	},
        	inform: {
        		share: 'Share information',
        		gather: 'Gather information',
        		teach: 'Teach',
        		learn: 'Learn'
        	},
        	relationship: {
        		trust: 'Build trust',
        		repair: 'Repair a relationship',
        		prospect: 'Develop a prospect',
        		introductions: 'Get introductions'
        	},
        	sell: {
        		pitch: 'Pitch',
        		deal: 'Close a deal',
        		expand: 'Expand business',
        		introduction: 'Get introductions',
        		other: 'Other'
        	}
        }
	},
    myContent: {
        pageSize: 5
    },
    event: {
		SERVER_TIME_UPDATE:	'serverTimeUpdate',
    	AUTHENTICATED:		'authenticated'
    }
});

meetingApp.factory('eventBroadcaster', function($rootScope) {
	// Create an application event bus.
    meetingApp.eventBus = $rootScope.$new();

    return {
        broadcast: function(msg) {
            $rootScope.$broadcast('appMessage', msg); 
        }
    };
});

meetingApp.config(function($provide, $httpProvider, $stateProvider, $urlRouterProvider) {
	
	// Force inclusion of AJAX flag in $http requests.
    $httpProvider.defaults.headers.common["X-Requested-With"] = 'XMLHttpRequest';
    // Check every request/response for an authentication failure.
    $httpProvider.interceptors.push('httpInterceptor');
	
    // Part of extension to $stateProvider to incorporate authentication.
	var isLoggedIn = ['$q', 'Authentication', function($q, Authentication) {
        var deferred = $q.defer();

        if (Authentication.isAuthenticated()) {
          deferred.resolve();
        } else {
        	Authentication.getAuthenticatedUser().success(function(){
        		deferred.resolve();
        	}).error(function(){
                deferred.reject({ needsAuthentication: true });
        	});
          }

        return deferred.promise;
      }
    ];

    // Use angular-ui-router state-based router.
	// Extends stateProvider to require authentication on routes.
	// Failure is handled by routeChangeError handler.
    $stateProvider.authState =  function(name, definition) {
    	definition.resolve = definition.resolve || {};
    	angular.extend(definition.resolve, { isLoggedIn: isLoggedIn });
    	return $stateProvider.state(name, definition);
    };


    /*
     * Application view routes.
     */
    
    // For any unmatched url, redirect to default state
    $urlRouterProvider.otherwise("/mycontent/actions/overdue");
    //
    // Set up the states
    // NOTE: to prevent the controller from being instantiated twice, define the controller in the route here
    //       and not in the template with ng-controller

    // My Content routes
    $stateProvider
    	// Top-level MyContent view.
    	.authState('mycontent', {
    		url: '/mycontent',
    		abstract: true,  // can't access this directly, must always go to a sub-view.
    		templateUrl: 'partials/layout/layout.html',
    		controller: 'MyContentCtrl'
    	})
    	// MyContent content area (Actions, Meetings, Decisions).
    	.authState('mycontent.contentArea', {
    		url: '/:contentArea',
    		templateUrl: function ($stateParams){
    			var contentArea = angular.equals($stateParams.contentArea, 'agendas') ||
    				angular.equals($stateParams.contentArea, 'summaries')?
    				'meetings':$stateParams.contentArea;
    			return 'partials/mycontent-' + contentArea + '.html';
    		},
    		controller: 'MyContentAreaCtrl'
        })
		// MyContent content area sub-view (tabs).
		.authState('mycontent.contentArea.view', {
			url: '/:view',
	        controller: 'MyContentAreaViewCtrl'
	    });
    // MyContent notification response
    $stateProvider
		.authState('mycontent-notification', {
			url: '/mycontent/meeting/:meetingId/action/:actionId/:actionStatus',
	        templateUrl: 'partials/layout/layout.html',
	        controller: 'NotificationResponseCtrl'
	    });
    // Meeting routes
    $stateProvider
    	.authState('meeting', {
    		url: '/meeting/:meetingId',
    		templateUrl: 'partials/layout/layout.html',
    		controller: 'MeetingDetailCtrl'
        });
    // Meeting edit
    $stateProvider
		.authState('meeting-new', {
			url: '/meetingnew',
	        templateUrl: 'partials/meeting-prep.html',
	        controller: 'MeetingPrepCtrl'
	    });
    $stateProvider
		.authState('meeting-edit', {
			url: '/meetingedit/:meetingId',
	        templateUrl: 'partials/meeting-prep.html',
	        controller: 'MeetingPrepCtrl'
	    });
    // Tenant Admin routes
    $stateProvider
		.authState('tenantAdmin', {
			url: '/tenantAdmin',
	        templateUrl: 'partials/layout/layout.html',
	        controller: 'TenantCtrl'
	    });
    //Registration
    $stateProvider
		.state('registration', {
			url: '/registration',
	        templateUrl: 'partials/layout/registration/registration.html',
	        controller: 'RegistrationCtrl'
	    });
    $stateProvider
		.state('registration-invitation', {
			url: '/registration/:invitationToken',
	        templateUrl: 'partials/meeting-summary.html',
	        controller: 'RegistrationCtrl'
	    });
    //Verify email
    $stateProvider
		.state('registration-verify', {
			url: '/registration/verify/:token',
	        templateUrl: 'partials/layout/registration/verifyEmail.html',
	        controller: 'RegistrationCtrl'
	    });

    
    // Login route
    $stateProvider
		.state('login', {
			url: '^/login',
	        templateUrl: 'partials/login.html',
	        controller: 'UserLoginCtrl'
	    });
    // Logout route
    $stateProvider
		.authState('logout', {
			url: '^/logout',
	        templateUrl: 'partials/login.html',
	        controller: 'UserLogoutCtrl'
	    });

	
	/*
	 * Override the bootstrap accordian to use local templates.
	 */
    $provide.decorator('accordionGroupDirective', function($delegate) {
        //we now get an array of all the accordionDirectives, 
        //and use the first one
        $delegate[0].templateUrl = 'partials/template/accordion/igo-accordion-group.html';
        return $delegate;
    });
    
	/*
	 * Override the bootstrap accordian to use local templates.
	 */
    /*
    $provide.decorator('textAngularToolbarDirective', function($delegate) {
        // Get the original directive.
        var directive = $delegate[0];
        var directiveCompile = directive.compile;
        
        directive.compile = function(elem, attr, transclude) {
        	console.error("+++++ TA COMPILE");
        	var directiveRef = directive;
        	var directiveLink = this.link;
//        	this.link = function(scope, element, attrs) {
//            	console.error("+++++ TA LINK");
//            	// Call the super.
//        		directiveLink(scope, element, attrs);
//            	// Inject new group elements.
//    			angular.forEach(scope.toolbar, function(group){
//    				// Loop the the toolbar groups
//    				var toolElement;
//    				angular.forEach(group, function(tool){
//    					// Inject a new group element before each tool, to provide justified tool sizing.
//    					toolElement = scope.tools[tool].$element;
//    					toolElement.after( "</div>" );
//    					toolElement.before( "<div class='btn-group'>" );
//    				});
//    			});
//        	};
        	
        	// Call the super.
        	var compiled = directiveCompile(elem, attr, transclude);
        };
        
        return $delegate;
    });
    */
});

meetingApp.run(['$rootScope', 'Constants', 'eventBroadcaster', '$location', 'Authentication', '$modalStack', 'textAngularManager',
    function($rootScope, Constants, eventBroadcaster, $location, Authentication, $modalStack, textAngularManager) {

	// Holder for application-wide server-related data.
	$rootScope.server = {};
	/* Meeting server time update */
	meetingApp.eventBus.$on(Constants.event.SERVER_TIME_UPDATE, function(event, message) {
	    	var serverTime = message.body;
	    	$rootScope.server.timeDate = serverTime;
			meetingApp.eventBus.$emit(Constants.meeting.event.TIME_UPDATE, $rootScope.server.timeDate);
    });

    // Intercept routeChangeErrors due to authentication failure, and redirect to login.
    // This handles detection of failed authentication when user navigates between views.
    $rootScope.$on('$stateChangeError', function(event, toState, toParams, fromState, fromParams, rejection) {
        if (rejection && rejection.needsAuthentication === true) {
        	// TODO: This line may not be necessary.
            var returnUrl = $location.search().u ||  $location.url();
            // User needs authentication, redirect to /login and pass along the return URL
            $location.path('/login').search({ u: returnUrl });
        }
    });

    $rootScope.$on('$locationChangeSuccess', function () {
        var urlParts = $location.path().split('/');
        if (urlParts.length >= 2) {
            $rootScope.layoutSection = urlParts[1];
            $rootScope.showSymantecSeal = angular.isString(urlParts[1]) && urlParts[1] == "login";
        }
        else {
            $rootScope.layoutSection = 'mycontent';
        }
    });
    // Add event listener to close any modal dialog when the view is changed.
    $rootScope.$on('$stateChangeStart', function(){
    	$modalStack. dismissAll();
    });
    
    meetingApp.popoverDismissHandler = function (e) {
        //Find all elements with the popover attribute
        var popups = document.querySelectorAll('*[popover-template]');
        if(popups) {
        	//Go through all of them
          for(var i=0; i<popups.length; i++) {
        	  //The following is the popover DOM elemet
        	  var popup = popups[i];
        	  	//The following is the same jQuery lite element
        	  var popupElement = angular.element(popup);
	        
        	  var content;
        	  var arrow;
        	  var nextEl = popupElement.next();
        	  if(angular.isElement(nextEl)) {
        		  nextEl = angular.element(nextEl);
        		  if(nextEl.hasClass('popover')) {
            		  //The content child in the popover's first sibling
            		  content = nextEl.find('.popover-inner');
            		  //The arrow child in the popover's first sibling
            		  arrow = nextEl.find('.arrow');
            		  if(angular.isElement(content)) { // The popover is open for nextEl.
                    	  if(popup != e.target && !popup.contains(e.target) && 
                    			  e.target != content[0] && !content[0].contains(e.target) &&
                    			  e.target != arrow[0] && !arrow[0].contains(e.target)) {
                			  //Remove the popover from the view.
                              if (nextEl[0].parentNode) {
                            	  nextEl[0].parentNode.removeChild(nextEl[0]); 
                              }
                			  //Set the scope to reflect this
                			  popupElement.scope().tt_isOpen = false;
                			  break;
                    	  }
            		  }
        		  }
        	  }
          }
        }
    };
    // Add event listener to close any popover when a click occurs outside the popover.
    angular.element(document.body).bind('click', meetingApp.popoverDismissHandler);

    

    // Wait for authentication to complete before initializing the application.
    // I.e., only make the websocket connection after authentication is complete.
	$rootScope.authenticatedUser = null;
	var unWatch = $rootScope.$watch('authenticatedUser', function() { 
		if(Authentication.isAuthenticated()) {
			// Initialize the websocket connection.
			meetingApp.connect(meetingApp.connect_callback, meetingApp.connect_error_callback);
//			unWatch();
		}
	}, true);

	// Application initialization
    meetingApp.init = function() {

    	// Set up the WebSocket connection and subscription.

    	meetingApp.stompClient = null;
    	meetingApp.stompMessage = "";

        // The default socket_onclose_callback callback
    	meetingApp.socket_onclose_callback = function() {
            console.log('>> SOCKJS Socket error: close');
            meetingApp.disconnect(true);
        };

    	meetingApp.connect = function(connect_callback, connect_error_callback) {
    	    var socket = new SockJS('/api/meetings/pubsub');
    	    meetingApp.stompClient = Stomp.over(socket);
    	    meetingApp.stompClient.connect('guest', 'guest', connect_callback, connect_error_callback);
    	    
    	    // Listen for socket connection error.
    	    socket.onclose = meetingApp.socket_onclose_callback;

    	    // TODO: actually handle errors via socket.onerror EventHandler

    	};

    	meetingApp.connect_callback = function(frame) {
    	    // After successful connection, set up subscriptions.
    		if(!angular.isDefined(meetingApp.sessionConnectionSubscription)) {
    			meetingApp.sessionConnectionSubscription = meetingApp.stompClient.subscribe('/user/meetings/connect', 
        	    	function(message) {
    	    	    	// Subscription event handler.  Fire an event to the eventbus, for UI component subscribers.
        	    		message = meetingControllers.messageFromJson(message);
        	    		console.log("+++ user connected: " + message);
    	    	    	meetingApp.eventBus.$emit(message.headers.type, $scope, message);
        	    	}, { id: 'sessionConnectionSubscription' });
    		}
			meetingApp.eventBus.$emit(Constants.meeting.event.WEBSOCKET_CONNECT, true);
            /*
             * Once the websocket connection is made, subscribe for server time updates in order
             * to keep the meeting time display (and other components relying on time synch) updated in synch with the server.
             */
			meetingApp.stompClient.subscribe('/topic/meetings/pubsub.meeting.time', 
	    	    	function(message) {
		    	    	// Subscription event handler.  Fire an event to the eventbus, for UI component subscribers.
	    	    		message = meetingControllers.messageFromJson(message);
		    	    	meetingApp.eventBus.$emit(Constants.event.SERVER_TIME_UPDATE, message);
	    	    	}, 
	    	    	{id: 'serverTimeUpdateSubscription'});

    	};

    	meetingApp.connect_error_callback = function(error) {
    	    // display the error's message header:
    	    console.log("Error: Lost Websocket connection: " + error);
    	    
    	    // The error callback occurs when the websocket connection is broken, either due
    	    // to session timeout or manual logout. 
    	    
    	    // Try to re-connect. If re-connect failed, unsubscribe and re-direct to login.
    	    // Don't do this if we are already on the login page, since we could only have already
    	    // gotten there from a previously-connected state, by explicitly logging out.
    	    if(!angular.equals($location.path(), '/login')) {
    	    	// Try to re-connect; we can't expect this to work in most connection failure scenarios,
    	    	// since they are likely to be due to an unreachable server.  For some other spurious
    	    	// error, this may allow the application to continue un-interrupted.

    	    	var redirect_to_login_error_callback = function() {
                    // Unsubscribe the subscriptions as part of the disconnection.
                    angular.forEach(meetingApp.stompClient.subscriptions, function(subscription, key) {
                        // Unsubscribe all subscriptions, except the session connection subscription.
                        if(!angular.equals('sessionConnectionSubscription', key)) {
                            meetingApp.stompClient.unsubscribe(key);
                        }
                    });
                    // After cleaning up subscriptions, handle the disconnect by re-directing to login, to re-establish the connection.
                       var returnUrl = $location.search().u ||  $location.url();
                       // User needs authentication, redirect to /login and pass along the return URL
                       $location.path('/login').search({ u: returnUrl });
                       // Call $apply(), because this occurs outside of a $digest, in response to a websocket event.
                       $rootScope.$apply();
                };

                // Override the default socket_onclose_callback
                meetingApp.socket_onclose_callback = redirect_to_login_error_callback;

                // Try to re-connect
        	    meetingApp.connect(meetingApp.connect_callback, redirect_to_login_error_callback);

    	    }

    	};

    	meetingApp.disconnect = function(reconnect) {
    		meetingApp.stompClient.disconnect();
    		if(reconnect) {
    			meetingApp.connect_error_callback("Disconnected");
    		}
    	    console.log("Disconnected");
    	};

//    	}); // $on.('authenticated')

    };
    
	// Initialize the application.
	meetingApp.init($rootScope, $location);

}]);
