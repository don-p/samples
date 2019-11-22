'use strict';

/* Services */

var meetingServices = angular.module('meetingServices', ['ngResource']);

meetingServices.factory('Meeting', ['$resource', '$location',
    function($resource, $location){
    	return $resource('/api/meetings/:meetingId', {}, {
    		query: {method:'GET', isArray:false},
    		update: {method:'PUT'}
//        query: {method:'GET', params:{meetingId:'1'}, isArray:false}
//    return $resource('phones/:phoneId.json', {}, {
//      query: {method:'GET', params:{phoneId:'phones'}, isArray:true}
    	});
	}
]);


meetingServices.factory('Action', ['$resource', '$location',
    function($resource){
        return $resource('/api/meetings/:meetingId/actions/:actionId', {}, {
            patch: {method: 'PATCH'},
            update: {method: 'PUT'}
        });
    }
]);

meetingServices.factory('UserProfile', ['$resource', '$location',
    function($resource, $location){
		return $resource('/api/user-profiles', {});
	}
]);

meetingServices.factory('MeetingDocument', ['$resource',
    function($resource){
		return $resource('/api/igodocument/', {meetingId: '@meeting.id'}, {
			query: {method:'GET', isArray:false}
		});
	}
]);





//meetingServices.factory('UserProfile', ['$resource',
//  function($resource){
//	return $resource('/api/user-profiles/me', {}, {
//		query: {method:'GET', isArray:false}
//	});
//}]);

meetingServices.factory('UserSearch', ['$resource',
                                            function($resource) {
                                        		return $resource('/api/user-profiles', {}, {
                                        			query: {method:'GET', params:{q:'@q'}, isArray:true}
                                        		});
                                        	}
                                        ]);

meetingServices.factory('IndiggoSearch', ['$resource',
    function($resource) {
        return $resource('/api/search/searchAll?max=:max&index=:index&searchTerm=:searchTerm', {}, {
            query: {method:'GET', isArray:false}
        });
    }
]);



meetingServices.factory('PostponedTopics', ['$resource',
    function($resource) {
		return $resource('/api/postponed-topics?userProfileId=:userProfileId', {}, {
			query: {method:'GET', isArray:true}
		});
	}
]);

meetingServices.factory('MyFrequentContacts', [ '$resource',
		function($resource) {
			return $resource('/api/mycontent/frequentContacts', {}, {
				query : {method : 'GET',isArray : true}
			});
		} 
]);

meetingServices.factory('TenantService',['$http','$resource',
function($http){
	return {
		currentTenant: {},
		getTenant: function(){
            var _this = this;
			
			var req = 	$http.get('/api/tenants/current-tenant');
			return req.success(function(data,status){_this.currentTenant = data;});
		},
		getTenantMembers: function(tenantId){
			var req = 	$http.get('/api/tenants/' + tenantId + '/members');
			return req;
		},
		addTenant: function(tenant){
			var req = $http.post('/api/tenants',tenant);
			return req;
		},
		listTenants: function(){
			var req = 	$http.get('/api/tenants');
			return req;

		},
		addUserToTenant: function(userEmail, tenantid, tenantRole){
			var req = 	$http.post('/api/tenants/' + tenantid + '/members',
		            {params:{'userEmail':userEmail, 'tenantRole':tenantRole}});
			return req;
		},
		removeMemberFromTenant: function(userId, tenantid){
			var req = 	$http.delete('/api/tenants/' + tenantid + '/members/' + userId,
		            {params:{'userId':userId}});
			return req;
		}
	};
}
                                        
 ]);

meetingServices.factory('MeetingService', [ '$http', '$resource', 'Meeting', 'Action', 'MessageQService', 
                                            'ModalService', 'Constants', '$rootScope', '$timeout',
function($http, $resource, Meeting, Action, MessageQService, ModalService, Constants, $rootScope, $timeout){
	return {

		getMeeting: function(meetingId) {
			return Meeting.get(meetingId);
		},
			
        /*
         * Add an Action to the list of meeting actions.
         * Show a modal dialog, send websocket message from
         * the dialog handler.
         * Since this modal may also be displayed over a popover that's dismissed by a click on
         * the body element, un-bind/re-bind the click listener on the modal show/hide, to suspend
         * the body click event handler while the modal is shown.
         */
        editAction: function(scope, action, isPreMeeting, meeting, httpSuccess, httpError) {
           	var editScope = scope.$new();
           	editScope.action = angular.isObject(action)?angular.copy(action):{};
           	editScope.meeting = meeting;
           	editScope.isPreMeeting = isPreMeeting;
           	editScope.Constants = Constants;
           	editScope.MeetingService = this;
           	
        	// Action if new, will be associated with the selected topic.
           	// Currently assumes calling from meeting view, with a context of a selected topic.
           	if((!angular.isObject(action) || !angular.isString(action.id)) && !isPreMeeting) {
               	var topic = meeting.selectedTopic;
	           	if(angular.isObject(topic)) {
	           		editScope.action.topicId = topic.id;
	           	}
           	}
        	// show the dialog.
        	var modalInstance = ModalService.createModal({
        		templateUrl: 'partials/actionForm.html',
        		size: 'sm',
        		windowClass: 'igo-meeting-modal',
        		scope: editScope
        	},
        	function (action) {
        		if(!angular.isNumber(action.createdDate)) {
	        		action.createdDate = new Date().getTime();
	        		action.assignedDate = action.createdDate;
        		} else {
	        		action.modifiedDate = new Date().getTime();
        		}
        		if(angular.isDate(action.dueDate)) {
            		action.dueDate = action.dueDate.getTime();
        		}
        		
        		// Set a new action status state, if the action is new.
        		// The default state of an Action at creation is ASSIGNED.
        		if(!angular.isString(action.actionStatus)) {
        			action.actionStatus = 'ASSIGNED';
        		}
        		
        		// Check for an action.assignedTo value that is an email address instead of a UserProfile object.
        		if(!angular.isObject(action.assignedTo)) {
        			action.assignedTo = {email: action.assignedTo};
        		}
        		
        		/*
        		 * Save according to use case - 
        		 * For meeting preparation, call action update if meeting already exists,
        		 * otherwise call meeting save.
        		 * For in-meeting, always call meeting update.
        		 * If http callbacks are present, then use http/REST for MyContent, instead 
        		 * of websocket for in-meeting.
        		 */
        		if(angular.isFunction(httpSuccess)) {
        			// Make http request with success/error callbacks.
                    Action.update({meetingId: meeting.id, actionId: action.id}, angular.toJson(action), httpSuccess, httpError);
        		} else if(angular.isString(meeting.id)) {
        			// Update the action for the existing meeting.
            		MessageQService.publishActionChangeEvent(Constants.meeting.event.ACTION_UPDATE, action,
            				{meetingId: meeting.id});
        		} else {
        			// Ensure meeting is created for the action, as
        			// part of saving the action.  Applies only to calling
        			// from the meeting editor, where an action may possibly be 
        			// created prior to creation./saving of the meeting.
            		MessageQService.publishAgendaChangeEvent(Constants.meeting.event.AGENDA_UPDATE, 
            				{meetingId: meeting.id, meeting: meeting});
        		}
        		editScope.$destroy();
        		// Re-bind the body element click listener, after the modal action event has been processed.
        		$timeout(function(){
        			angular.element(document.body).bind('click', meetingApp.popoverDismissHandler);
        		}, 0);
        	},
        	function () {
        		// Modal cancelled.
        		editScope.$destroy();
        		// Re-bind the body element click listener, after the modal action event has been processed.
        		$timeout(function(){
        			angular.element(document.body).bind('click', meetingApp.popoverDismissHandler);
        		}, 0);
        	});
    		// Un-bind the body element click listener, to avoid being triggered by action event.
        	angular.element(document.body).unbind('click', meetingApp.popoverDismissHandler);
        },
        
        // Delete action
        deleteAction: function(action, meetingId, httpSuccess, httpError) {
    		/*
    		 * Delete according to use case - 
    		 * If http callbacks are present, then use http/REST for MyContent, instead 
    		 * of websocket for in-meeting.
    		 */
    		if(angular.isFunction(httpSuccess)) {
    			// Make http request with success/error callbacks.
                Action.remove({meetingId: meetingId, actionId: action.id}, httpSuccess, httpError);
    		} else {
    			// Delete the action for the existing meeting over websocket.
        		MessageQService.publishActionChangeEvent(Constants.meeting.event.ACTION_DELETE, action,
        				{meetingId: meetingId});
    		}
        },

        formatUserProfile: function(model) {
        	var result = "";
        	if(angular.isObject(model)) {
        		if(angular.isString(model.firstName) || angular.isString(model.lastName)) {
        			result = model.firstName + ' ' + model.lastName;
        		} else if(angular.isString(model.email)) {
        			result = model.email;
        		}
        	}
            return result;
        }
         
	};
}                                        
]);

meetingServices.factory('MyContent', [ '$http', '$resource', 'Action',
function($http, $resource, Action){
	
    function appendPage (existingData, data) {
    	if(angular.equals(existingData.number,-1)) {
    		// If the current page number of the list being updated is -1,
    		// this means that the request was a reset - the query criteria has changed
    		// and we are generating a new initial query, not appending results
    		// to a previous query; so, clear the current page list before setting
    		// the results into the data structure.
    		existingData.content = [];
    	}
    	// Append the incoming content data to the existing data, and save.
        data.content = existingData.content.concat(data.content);
        // Copy the incoming page metadata to the existing page structure, with the appended content.
        angular.extend(existingData, data);
    }

	return {
	    nextMeeting: {},
		isTenantAdmin: {},
		
		// Object tracking state of selected sub-views in MyContent content areas, with defaults.
		contentAreaView: {
			actions: 'upcoming',
			summaries: 'past',
			agendas: 'future',
			decisions: 'all'
		},

		detectTenantAdmin: function(){
            var _this = this;
			
			var req = 	$http.get('/api/tenants/isTenantAdmin');
			return req.success(function(data,status){_this.isTenantAdmin = data;});
		},
 
        getDecisions: function (decisions, decisionMaker, pageNumber, count) {
            var req = $http.get('/api/mycontent/getDecisions',
                {params: {'decisionMaker': decisionMaker ? decisionMaker.id : null,
                    'includeGroup': 'true', 'pageNum': pageNumber, 'pageSize': count}});
            return req.success(function (data, status) {
                appendPage(decisions, data);
            });
        },
        getActions: function (actions, assignedTo, actionState, pageNumber, count) {
            var req = $http.get('/api/mycontent/getActions',
                {params: {'assignedTo': assignedTo ? assignedTo.id : null, 'actionState': actionState, 'pageNum': pageNumber, 'pageSize': count}});
            return req.success(function (data, status) {
                appendPage(actions, data);
            });
        },
        getMyActions: function (creator, assignedTo, actionState, success, error) {
            var req = $http.get('/api/mycontent/actions',
            			{params: {'creatorProfileId':  creator ? creator : null, 
                		'assigneeProfileId': assignedTo ? assignedTo : null, 
                		'actionStatus': actionState}
                });
            return req.success(success).error(error);
        },

        getPastMeetings: function (pastMeetings, forUser, pageNumber, count) {
            var req = $http.get('/api/meetings/findPastMeetings',
            		{params: {'user': forUser ? forUser.id : null, 'pageNum': pageNumber, 'pageSize': count}});
            return req.success(function (data, status) {
                appendPage(pastMeetings, data);

            });
        },
        getFutureMeetings: function (futureMeetings, forUser, pageNumber, count) {
            var req = $http.get('/api/meetings/findFutureMeetings', 
            		{params: {'user': forUser ? forUser.userId : null, 'sortAscending': true, 'pageNum': pageNumber, 'pageSize': count}});
            return req.success(function (data, status) {
                appendPage(futureMeetings, data);
            });
        },
        getNextMeeting: function () {
            var _this = this;
            _this.nextMeeting = null;

            var req = $http.get('/api/meetings/findFutureMeetings', {params: {'pageNum': 0, 'pageSize': 1}});
            return req.success(function (data, status) {
                _this.nextMeeting = data.content.length == 1 ? data.content[0] : null;

                if (_this.nextMeeting != null) {
                    var startsInMinutes = Math.floor((_this.nextMeeting.startDate - new Date()) / 60000);
                    var minutesPerDay = 60 * 24;
                    if (startsInMinutes >= minutesPerDay) {
                        _this.nextMeeting.startsInTime = Math.floor(startsInMinutes / minutesPerDay);
                        _this.nextMeeting.startsInUnits = "day";
                    }
                    else if (startsInMinutes >= 60) {
                        _this.nextMeeting.startsInTime = Math.floor(startsInMinutes / 60);
                        _this.nextMeeting.startsInUnits = "hour";
                    }
                    else {
                        _this.nextMeeting.startsInTime = startsInMinutes;
                        _this.nextMeeting.startsInUnits = "minute";
                    }
                }
            });
        },
        
        setActionStatus: function (action, meetingId, status, success, error) {
            Action.patch({meetingId: meetingId, actionId: action.id}, angular.toJson({actionStatus: status}), success, error);
        }


    };
}
                                       
]);


meetingServices.factory('Authentication',['$http', '$location', '$modal', '$rootScope', 
    function($http, $location, $modal, $rootScope) {
	    return {
		    authenticate: function(credentials) {
		    	return $http({method: 'POST', url: '/login', data : $.param(credentials),
		    	            headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'}});
		    },
		    isAuthenticated: function() {
		    	// Check that the user is logged in. 
		    	return angular.isObject($rootScope.authenticatedUser);
	        },
	    	// Attempt to retrieve a currently-authenticated UserProfile object on
	    	// initial application launch.  One of two things will occur:
	    	// 1. If the user had a previously-authenticated session that has not
	    	// timed out, we will get and set the UserProfile, which will be detected by
	    	// the $rootScope.authenticatedUser watcher, to set the application's authenticated state.
	    	// 2. If the user did not have a previously-authenticated valid session,
	    	// the http request will return a 401 error which is detected by the
	    	// httpInterceptor and will forward to the login page.
	        getRemoteAuthenticatedUser: function() {
                return $http({method: 'GET', url:'/api/user-profiles/me'}).success(function(userProfile, status){
    	    		$rootScope.authenticatedUser = userProfile;
    	    	});
	        },
	        getAuthenticatedUser: function() {
	        	return angular.isObject($rootScope.authenticatedUser)?
	        			$rootScope.authenticatedUser:
	        			this.getRemoteAuthenticatedUser();
	        },
		    logout: function() {
		    	return $http({method: 'GET', url: '/logout'});
		    },
	        authenticationErrorMessage: function(statusCode) {
	        	
	        },
            curTenant: function() {
                return $http({method: 'GET', url:'/api/tenants/info'});
            }
		   
	    };
	}
]);

/*
 * Global http exception handler.
 */
meetingServices.factory('httpInterceptor', 
	function httpInterceptor($q, $window, $location) {
	// Intercept httpErrors due to authentication failure, and redirect to login.
	// This handles detection of failed authentication when RESTful service requests are made.
		return {
			response: function(response) {
				return response;
			},

			responseError: function(response) {
		        if (response.status === 401) {
		        	// User needs authentication, redirect to /login and pass along the return URL
		            var returnUrl = $location.search().u ||  $location.url();
		            $location.path('/login').search({ u: returnUrl });
		        } else {
		        	// other error types
		        	console.log("HttpInterceptor: error: " + response.status);
		        }
	
		        return $q.reject(response);
		    }
		};
});

meetingServices.factory('ModalService', ['$modal',
    function($modal) {
       	return {
                createModal: function (config, closeCallback, dismissCallback) {
                    // show the dialog.
                    var modalInstance = $modal.open(config);
                    modalInstance.result.then(closeCallback, dismissCallback);
                }
            }
       }
]);


meetingServices.factory('DebounceService',
    function($modal) {
        return {
			debounce: function(func, wait) {
				// we need to save these in the closure
				var timeout, args, context, timestamp, timeout;
			
				return function() {
			
					// save details of latest call
					context = this;
					args = [].slice.call(arguments, 0);
					timestamp = new Date();
			
					// this is where the magic happens
					var later = function() {
			
					    // how long ago was the last call
					    var last = (new Date()) - timestamp;
				
					    // if the latest call was less that the wait period ago
					    // then we reset the timeout to wait for the difference
					    if (last < wait) {
					    	timeout = setTimeout(later, wait - last);
					    // or if not we can null out the timer and run the latest
					    } else {
					    	timeout = null;
					    	func.apply(context, args);
					    }
					};
			
					// we only need to set the timer now if one isn't already running
					if (!timeout) {
						timeout = setTimeout(later, wait);
					}
				};
			}
        };
	}
);


meetingServices.factory('MessageQService', ['DebounceService', 'Constants',
    function(DebounceService, Constants) {
      	return {
            /* sending of various websocket events */
            // topic selection change.  sent only to the topic queue, not the app, for peer-to-peer update only.
            publishTopicSelectionEvent: function(topicId) {
    	        meetingApp.stompClient.send('/topic/meetings/'+meetingApp.selectedMeeting.id+'/pubsub.topic', 
    	            	{meetingId: meetingApp.selectedMeeting.id, type: Constants.meeting.event.TOPIC_SELECTION},
    	            	angular.toJson({topicId: topicId})
    	            );
            },
            //FIXME: not used.
            // meeting data change: sent to the app queue, for persistence and messaging.
            publishMeetingChangeEvent: function(eventType, config) {
                meetingApp.stompClient.send('/app/meetings/'+meetingApp.selectedMeeting.id+'/pubsub.meeting', 
                   	angular.extend({type: eventType}, config), angular.toJson(meetingApp.selectedMeeting)
                );            	
            },
            // meeting agenda data change.
            publishAgendaChangeEvent: function(eventType, config) {
                meetingApp.stompClient.send('/app/meetings/'+meetingApp.selectedMeeting.id+'/pubsub.meeting', 
                   	angular.extend({type: eventType}, config), angular.toJson(config.meeting)
                );            	
            },
            // meeting agenda topic postponed change.
            publishTopicPostponedEvent: function(eventType, topic, config) {
                meetingApp.stompClient.send('/app/meetings/'+meetingApp.selectedMeeting.id+'/pubsub.meeting.topic', 
                   	angular.extend({type: eventType}, config), angular.toJson(topic)
                );            	
            },
           // meeting data change: add new actions.  sent to the app queue, for persistence and messaging.
            publishActionChangeEvent: function(eventType, action, config) {
            	// Action changes can occur outside the context of the meeting view, so use meetingId 
            	// from config, not from meeting view selected meeting.
            	var meetingId = config.meetingId;
                meetingApp.stompClient.send('/app/meetings/'+meetingId+'/pubsub.meeting.action', 
                	angular.extend({type: eventType}, config), angular.toJson(action)
                );            	
            },
            // meeting data change: add new decisions.  sent to the app queue, for persistence and messaging.
            publishDecisionChangeEvent: function(eventType, decision, config) {
                meetingApp.stompClient.send('/app/meetings/'+meetingApp.selectedMeeting.id+'/pubsub.meeting.decision', 
                	angular.extend({type: eventType}, config), angular.toJson(decision)
                );            	
            },
            // meeting topic notes updates: replace current notes with new message data.  sent to the app queue, for persistence and messaging.
            publishMeetingNotesChangeEvent: DebounceService.debounce(
                 // debounce call for X milliseconds, to avoid excessive message sends and DB writes responding to keyboard input.
            	function(topicId, note) {
    	            // Broadcast the event to subscribers.
    	            meetingApp.stompClient.send('/app/meetings/'+meetingApp.selectedMeeting.id+'/pubsub.meeting.note', 
    	            	{type: Constants.meeting.event.NOTE_UPDATE, topicId: topicId},
    	            	angular.toJson(note)
    	            );
            	}
            , 666)
      	};
	}
]);

meetingServices.factory('Topic', function () {
	 
	/**
	 * Constructor, with class name
	 */
	function Topic(topic) {
		// Public properties, assigned to the instance ('this')
		angular.extend(this, topic);
	}
	 
	/**
	 * Public method, assigned to prototype
	 */
	Topic.prototype.toString = function () {
		return this.name;
	};
	 
	 
	/**
	 * Return the constructor function
	 */
	return Topic;
});

meetingServices.factory('Registration', ['$http', '$location', '$modal', '$rootScope',
    function($http, $location, $modal, $rootScope) {
        return {
            isEmailAvailable: function(newCredentials) {
                return $http({method: 'GET', url: '/api/simple-registrations/isEmailAvailable?email=' + newCredentials.email})
            },
            isUsernameAvailable : function(newCredentials) {
                return $http({method: 'GET', url: '/api/simple-registrations/isUsernameAvailable?username=' + newCredentials.username})
            },
            register : function(newCredentials) {
                return $http({method: 'POST', url: '/api/simple-registrations', data: newCredentials,  headers: { 'Content-Type': 'application/json; charset=UTF-8'}});
            },
            verifyEmail : function(token) {
                return $http({method: 'POST', url: '/api/simple-registrations/confirmation?token=' + token})
            },
            resendVerificationEmail : function(token) {
                return $http({method: 'POST', url: '/api/simple-registrations/new-link?token=' + token})
            }
        };
    }
]);
