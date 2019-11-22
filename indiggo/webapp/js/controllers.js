'use strict';

/* MeetingRoom Controllers */

var meetingControllers = angular.module('meetingControllers', []);

/*
 * Require the eventBroadcaster service so that the controller has access to the eventbus,
 * for registering listeners and firing events.
 * Register the event listeners relevant to this controller.
 */
meetingControllers.run(['$rootScope', 'Constants', '$filter', 'eventBroadcaster', '$timeout', '$document',
    function($rootScope, Constants, $filter, eventBroadcaster, $timeout, $document) {
        // Register event listeners on the event bus for meeting change/update events.
        /* Meeting action data change */
        meetingApp.eventBus.$on(Constants.meeting.event.ACTION_UPDATE, function(event, $scope, message) {
            var meetingId = message.headers.meetingId,
                action = message.body,
                meeting = $scope.meeting;
            if(meetingId === meeting.id) {
                $scope.$apply(function(scope) {
                    // Figure out whether to add new or replace existing Action.
                    var foundAction = Indiggo.Utils.findByIdInList(action.id, $scope.meeting.actions);
                    if(angular.isObject(foundAction)) {
                        // replace the action.
                        angular.extend(foundAction, action);
                    } else {
                        // can't find a matching action, insert a new action.
                        meeting.actions.push(action);
                    }
                });
            }
        });
        meetingApp.eventBus.$on(Constants.meeting.event.ACTION_DELETE, function(event, $scope, message) {
            var meetingId = message.headers.meetingId,
                action = message.body,
                meeting = $scope.meeting;
            if(meetingId === meeting.id) {
                // Remove existing Action.
                Indiggo.Utils.removeItemFromList(action, meeting.actions);
                $scope.$apply();
            }
        });

        /* Meeting decision data change */
        meetingApp.eventBus.$on(Constants.meeting.event.DECISION_UPDATE, function(event, $scope, message) {
            var meetingId = message.headers.meetingId,
                topicId = message.headers.topicId,
                decisionData = message.body;
            if(meetingId === $scope.meeting.id) {
                // Decisions are embedded into Topics (the Agenda), so as decisions
                // are updated, they could be moved between agenda topics - so, we
                // must update the entire agenda when we detect a change to decisions.
                var topic = Indiggo.Utils.findByIdInList(topicId, $scope.meeting.agenda);
                if(angular.isObject(topic)) {
                    // Update the agenda, which includes the newly-updated decision.
                    var decision = Indiggo.Utils.findByIdInList(decisionData.id, topic.decisions);
                    if(angular.isObject(decision)) {
                        // The decision is already in the specified topic, so update it.
                        angular.extend(decision, decisionData);
                    } else {
                        // The decision is being newly added to the specified topic, so may need
                        // to be removed from the currently-selected topic.
                        Indiggo.Utils.removeItemFromList(decisionData, $scope.meeting.selectedTopic.decisions);
                        // Add the decision to the new topic.
                        topic.decisions.push(decisionData);
                    }

                    $scope.$apply();
                }
            }
        });
        meetingApp.eventBus.$on(Constants.meeting.event.DECISION_DELETE, function(event, $scope, message) {
            var meetingId = message.headers.meetingId,
                topicId = message.headers.topicId,
                decision = message.body,
                meeting = $scope.meeting;
            if(meetingId === meeting.id) {
                // Find the topic.
                var topic = Indiggo.Utils.findByIdInList(topicId, $scope.meeting.agenda);
                if(angular.isObject(topic)) {
                    // Remove existing Decision.
                    Indiggo.Utils.removeItemFromList(decision, topic.decisions);
                    $scope.$apply();
                }
            }
        });

        /* Meeting note data change */
        meetingApp.eventBus.$on(Constants.meeting.event.NOTE_UPDATE, function(event, $scope, message) {
            var meetingId = message.headers.meetingId,
                topicId = message.headers.topicId,
                noteData = message.body;
            if(meetingId === meetingApp.selectedMeeting.id) {
                var topic = Indiggo.Utils.findByIdInList(topicId, $scope.meeting.agenda),
                    note = Indiggo.Utils.findByIdInList(noteData.id, topic.notes);
                note.content = noteData.content;
                $scope.$apply();
            }
        });
        /* Meeting data update change */ //TODO: Not used.
        meetingApp.eventBus.$on(Constants.meeting.event.MEETING_UPDATE, function(event, scope, message) {
            var meetingId = message.headers.meetingId;
            if(meetingId === meetingApp.selectedMeeting.id) {
                var id = message.body.id,
                    topic = angular.element('#igo-meeting-topic-' + id);
                if(angular.isElement(topic) && meetingApp.selectedMeeting.selectedTopic.id != id) {
                    topic.click();
                }
            }
        });
        /* Meeting agenda update change */
        meetingApp.eventBus.$on(Constants.meeting.event.AGENDA_UPDATE, function(event, scope, message) {
            var meetingId = message.headers.meetingId;
            if(meetingId === meetingApp.selectedMeeting.id) {
                var agenda = message.body.agenda;
                if(angular.isObject(agenda)) {
                    // Replace the agenda array.
                    scope.meeting.agenda = agenda;
                    // Fix up topic selection.
                    // Is the current selectedTopic missing in the new agenda or unset?
                    var selectedTopic = angular.isObject(scope.meeting.selectedTopic)?
                        Indiggo.Utils.findByIdInList(scope.meeting.selectedTopic.id, scope.meeting.agenda):
                        null;
                    // If topic is still in list nothing to do; if not, fix the selection.
                    if(!angular.isObject(selectedTopic) && scope.meeting.agenda.length > 0) {
                        var selectionTopic = scope.meeting.agenda[0];
                        if(angular.isObject(selectionTopic)) {
                            scope.meeting.selectedTopic = selectionTopic;
                        }
                    }
                    scope.$apply();
                }
            }
        });
        /* Meeting topic update change */
        meetingApp.eventBus.$on(Constants.meeting.event.TOPIC_UPDATE, function(event, scope, message) {
            var meetingId = message.headers.meetingId;
            if(meetingId === meetingApp.selectedMeeting.id) {
                var topic = message.body.topic,
                    updateOrder = message.headers.updateOrder
                var existingTopic = Indiggo.Utils.findByIdInList(topic.id, meetingApp.selectedMeeting.agenda);
                if(angular.isObject(topic)) {
                    angular.extend(existingTopic, topic);
                    scope.$apply();
                }
                if(!angular.isEmpty(updateOrder) && angular.isObject(existingTopic)) {
                    existingTopic.agendaItems.forEach(function(agendaItem, index) {
                        agendaItem.topicSort = index;
                    });
                    angular.extend(meetingApp.selectedMeeting.agenda, agenda);
                    scope.$apply();
                }
            }
        });
        /* Meeting agenda topic postponed change */
        meetingApp.eventBus.$on(Constants.meeting.event.TOPIC_POSTPONED, function(event, $scope, message) {
            var meetingId = message.headers.meetingId,
                topicData = message.body;
            if(meetingId === meetingApp.selectedMeeting.id) {
                // Find existing Topic.
                var topic = Indiggo.Utils.findByIdInList(topicData.id, $scope.meeting.agenda);
                if(angular.isObject(topic)) {
                    if(!topicData.postponed) {
                        // If un-postponing the last postponed topic, close the popover.
                        // Apply this first, to avoid showing the popover's empty state before it is closed.
                        var postponedTopics = $filter('filter')($scope.meeting.agenda, {postponed:true});
                        var popover = angular.element("div#postponedTopicContainer + div.popover.right");
                        if(angular.isElement(popover) && postponedTopics.length == 1 && topic === postponedTopics[0]) {
                            var popoverScope = popover.scope();
                            var popoverButton = angular.element("div#postponedTopicContainer");
                            if ( popoverScope.tt_animation ) {
                                popoverButton.click();
                                $scope.updateTopic(topicData, topic);
                                $timeout(function(){
                                    $scope.$apply();
                                }, 500);
                            } else {
                                popoverButton.click();
                                $scope.$apply(function($scope) {
                                    $scope.updateTopic(topicData, topic);
                                });
                            }
                        } else {
                            // Otherwise, if it's not the last topic in the popover being unpostponed,
                            // just update the topic model to update the UI.
                            $scope.$apply(function($scope) {
                                $scope.updateTopic(topicData, topic);
                            });
                        }
                    } else {
                        // Otherwise, if it's a topic  being postponed,
                        // just update the topic model to update the UI.
                        $scope.$apply(function($scope) {
                            $scope.updateTopic(topicData, topic);
                        });
                    }
                }
            }
        });
        /* Meeting topic selection change */
        meetingApp.eventBus.$on(Constants.meeting.event.TOPIC_SELECTION, function(event, scope, message) {
            var meetingId = message.headers.meetingId;
            if(meetingId === meetingApp.selectedMeeting.id) {
                var id = message.body.topicId,
                    topic = angular.element('#igo-meeting-topic-' + id);
                if(angular.isElement(topic) && meetingApp.selectedMeeting.selectedTopic.id != id) {
                    topic.click();
                }
            }
        });
    }]);

meetingControllers.controller('UserLogoutCtrl', ['$location', 'Authentication',

    function($location, Authentication) {
        // Log out the user session.
        // Redirect to the main entry point, which will then redirect to login via the httpInterceptor,
        // since authentication is no longer valid.
        Authentication.logout().error(function (data, status, headers, config) {
            if(status != 401) {
                console.error("Authentication: Error logging out - " + status);
            }
            $location.search('u', '' );
        });

    }]);

meetingControllers.controller('UserLoginCtrl', ['$scope', '$http', '$location', '$modal', 'Authentication', '$rootScope', 'Constants',


    function($scope, $http, $location, $modal, Authentication, $rootScope, Constants) {

        // If we are coming into the login controller, it is either:
        // 1. first login.
        // 2. failed login.
        // 3. expired session/logout.
        //
        // For case #3, we will already have a local authentication token, but no login errorMessage,
        // so we need to set a logout/session expiration message.
        // This depends on other services *not* removing the authentication token when an authentication failure occurs.
        if(!angular.isDefined($scope.errorMessage) && angular.isObject($rootScope.authenticatedUser)) {
            $scope.errorMessage = 'Your session has expired or you have logged out;<br>please log in again.';
            $rootScope.authenticatedUser = null;
        }

        $scope.loginTenant = {};

        Authentication.curTenant().success( function(data,status){$scope.loginTenant = data; });

        console.log($scope.loginTenant);

        $scope.login = function () {
            var returnUrl = $location.search().u;
            var success = function (data, status, headers, config) {
//	        var token = data.token;

                delete $scope.errorMessage;
                // Save the returned UserProfile object.
                $rootScope.authenticatedUser = data;
                meetingApp.eventBus.$emit(Constants.event.AUTHENTICATED, data);
                $location.path(returnUrl).search('');

//	        api.init(token);
//	
//	        $cookieStore.put('token', token);
//	        $location.path('/');
//			$route.reload();
            };

            var error = function (data, status, headers, config) {
                var errorMessage = 'Log in failed for this username/password.<br>Please try again.';
//	    	var errorMessage = headers("statusText");
                $scope.errorMessage = errorMessage;
            };

            Authentication.authenticate(this.credentials).success(success).error(error);
        };

    }]);

meetingControllers.controller('UserCtrl', ['$scope', 'Meeting',
    /*
     * Meeting participant presence has three states:
     * empty/null - attendee is not present.
     * online - attendee is present and logged in to the application.
     * present - attendee is present but not logged in to the application.
     * Online presence is detected and set by the application; empty/present 
     * status is manually set by the meeting leader, so toggling participant
     * presence should toggle only between the two states of empty/present.
     */
    function($scope, Meeting) {
        $scope.toggleAttendeePresence = function(meeting, attendee) {
            ;
        };

    }]
);

meetingControllers.controller('MeetingCtrl', ['$scope', 'Meeting',
    function($scope, Meeting) {
        $scope.meetingList = Meeting.query();
    }]
);

meetingControllers.controller('MeetingDatePickerCtrl', ['$scope', '$filter', 'Meeting', 'UserProfile', 'Constants', '$timeout', 'ModalService', '$rootScope', '$http',
    function($scope, $filter, Meeting, UserProfile, Constants, $timeout, ModalService, $rootScope, $http) {

        $scope.openDatePicker = function($event) {
            $event.preventDefault();
            $event.stopPropagation();

            $scope.datePickerOpened = true;
        };

    }]
);


meetingControllers.controller('MeetingDatePickerCtrl', ['$scope', '$filter', 'Meeting', 'UserProfile',
    'Constants', '$timeout', 'ModalService', '$rootScope', '$http',
    function($scope, $filter, Meeting, UserProfile, Constants, $timeout, ModalService, $rootScope, $http) {

        $scope.openDatePicker = function($event) {
            $event.preventDefault();
            $event.stopPropagation();

            $scope.datePickerOpened = true;
        };

    }]
);

meetingControllers.controller('MeetingDetailCtrl', ['$scope', '$filter', 'Meeting', 'UserProfile', 'Topic', 'Constants',
    '$timeout', 'ModalService', '$rootScope', '$http', 'MessageQService', 'MeetingService', '$document', '$stateParams',
    function($scope, $filter, Meeting, UserProfile, Topic,
             Constants, $timeout, ModalService, $rootScope, $http, MessageQService, MeetingService, $document, $stateParams) {

        var meetingId = $stateParams.meetingId;
        $scope.MeetingService = MeetingService;

        /*
         * Register meeting event listeners.
         */
        $scope.subscribeToEvents = function() {
            /* Meeting server time update */
            meetingApp.eventBus.$on(Constants.meeting.event.TIME_UPDATE, function(event, message) {
                var serverTime = message;
                $scope.remainingMeetingTime = $scope.getRemainingMeetingTime($scope.meeting, serverTime);
                $scope.$apply();
            });
        };

        /*
         * Register Meeting-related websocket pub/sub subscriptions.
         */
        $scope.subscribeToMeeting = function(meetingId) {
            console.log("Starting meeting websocket subscriptions...");

            meetingApp.stompClient.subscribe('/topic/meetings/'+meetingId+'/pubsub.topic',
                function(message) {
                    // Subscription event handler.  Fire an event to the eventbus, for UI component subscribers.
                    message = meetingControllers.messageFromJson(message);
                    meetingApp.eventBus.$emit(message.headers.type, $scope, message);
                },
                {id: 'topicSelectionSubscription', meetingId: meetingId});

            meetingApp.stompClient.subscribe('/topic/meetings/'+meetingId+'/pubsub.meeting',
                function(message) {
                    // Subscription event handler.  Fire an event to the eventbus, for UI component subscribers.
                    message = meetingControllers.messageFromJson(message);
                    meetingApp.eventBus.$emit(message.headers.type, $scope, message);
                },
                {id: 'meetingSubscription', meetingId: meetingId});

            meetingApp.stompClient.subscribe('/topic/meetings/'+meetingId+'/pubsub.meeting.action',
                function(message) {
                    // Subscription event handler.  Fire an event to the eventbus, for UI component subscribers.
                    message = meetingControllers.messageFromJson(message);
                    var action = message.body;
                    // For meeting editor, set a newly-updated/added action to be expanded.
                    action.expandedView = true;
                    meetingApp.eventBus.$emit(message.headers.type, $scope, message);
                },
                {id: 'actionSubscription', meetingId: meetingId});

            meetingApp.stompClient.subscribe('/topic/meetings/'+meetingId+'/pubsub.meeting.decision',
                function(message) {
                    // Subscription event handler.  Fire an event to the eventbus, for UI component subscribers.
                    message = meetingControllers.messageFromJson(message);
                    meetingApp.eventBus.$emit(message.headers.type, $scope, message);
                },
                {id: 'decisionSubscription', meetingId: meetingId});
            meetingApp.stompClient.subscribe('/topic/meetings/'+meetingId+'/pubsub.meeting.note',
                function(message) {
                    // Subscription event handler.  Fire an event to the eventbus, for UI component subscribers.
                    message = meetingControllers.messageFromJson(message);
                    meetingApp.eventBus.$emit(message.headers.type, $scope, message);
                },
                {id: 'noteSubscription', meetingId: meetingId});
            meetingApp.stompClient.subscribe('/topic/meetings/'+meetingId+'/pubsub.meeting.topic',
                function(message) {
                    // Subscription event handler.  Fire an event to the eventbus, for UI component subscribers.
                    message = meetingControllers.messageFromJson(message);
                    meetingApp.eventBus.$emit(message.headers.type, $scope, message);
                },
                {id: 'topicSubscription', meetingId: meetingId});
        };

        /* Meeting websocket subscriptions; subscribe after connect */
        if(angular.isObject(meetingApp.stompClient) && meetingApp.stompClient.connected) {
            // If we already have a websocket connection, start the websocket subscriptions.
            $scope.subscribeToEvents();
            $scope.subscribeToMeeting(meetingId);
        } else {
            // If not connected to websocket, register a listener to wait for the connection
            // event, and then after connection is made start the websocket subscriptions.
            var connectListener = meetingApp.eventBus.$on(
                Constants.meeting.event.WEBSOCKET_CONNECT, function(event, connected) {
                    // Start subscriptions.
                    if(connected) {
                        $scope.subscribeToEvents();
                        $scope.subscribeToMeeting(meetingId);
                        // De-register to execute listener once only.
                        connectListener();
                    }
                });
        }



        $scope.meeting = Meeting.get({meetingId: meetingId}, function(meeting) {
            // callback
            console.log("meeting:" + meeting.id);
            meetingApp.selectedMeeting = $scope.meeting;
            var topic = meeting.agenda[0];
            if(angular.isObject(topic)) {
                $scope.meeting.selectedTopic = topic;
            }

            $scope.Constants = Constants;
            $scope.postponedTopics = [];
            // Initialize the remaining meeting time with the actual meeting duration.
            $scope.remainingMeetingTime = $scope.getRemainingMeetingTime(meeting, meeting.startDate);
        });


        $scope.getMeetingAttendeeCost = function(){
            if ($scope.meeting == null){
                return 0;
            }
            var cost = 0;
            cost = _.reduce($scope.meeting.attendees, function(cost, num, key) {
                var personCost = $scope.meeting.attendees[key].hourlyCost;
                if (personCost == 0) { // field defaults to 0
                    personCost = !angular.isObject($scope.meeting.attendees[key].tenant) ? 0.0 : $scope.meeting.attendees[key].tenant.defaultHourlyCost;
                }
                return cost + personCost;
            }, cost);
            var durationHours = ($scope.meeting.endDate - $scope.meeting.startDate) / 60000 / 60;
            return cost * durationHours;
        };

        $scope.isMeetingOwner = function(){
            return ((angular.isDefined($scope.meeting.creator)) &&
                (angular.isDefined($rootScope.authenticatedUser)) &&
                $scope.meeting.creator.id == $rootScope.authenticatedUser.id);
        };


        $scope.saveMeeting = function(meeting) {
            console.debug("Saving meeting: " + meeting.id);
            meeting.$save();
        };

        /* sending of  websocket event for meeting notes */
        $scope.onMeetingNotesChange = function(topicId) {
            MessageQService.publishMeetingNotesChangeEvent(topicId, this.note);
        };

        /*
         * Select a topic from the list of meeting topics.
         */
        $scope.setSelectedTopic = function(meeting) {
            if(!angular.isObject(meeting.selectedTopic) || meeting.selectedTopic.id != this.topic.id) {
                // Select the topic by setting it into the scope.
                meeting.selectedTopic = this.topic;

                console.log('*** Publish topic event on Meeting fired. ***');
                // Broadcast the event to subscribers.
                MessageQService.publishTopicSelectionEvent(meeting.selectedTopic.id);
            }
        };

        /*
         * Get actions from the meeting that are associated with topics; not meeting-level actions.
         */
        $scope.isTopicAction = function(action) {
            // Return true if the action is associated with a topic.
            if (action != null) {
                return angular.isString(action.topicId);
            }else{
                return false;
            }
        };
        $scope.isPreMeetingAction = function(action) {
            // Return false if the action is associated with a topic.
            return !angular.isString(action.topicId);
        };

        /*
         * An Action has a topicId; return the topic name value for the Topic associated with this topicId.
         */
        $scope.getActionTopic = function(action) {
            if (action == null){
                return '';
            }
            var found = $filter('filter')($scope.meeting.agenda, {id: action.topicId}, true);
            if (found.length) {
                return found[0].name;
            } else {
                return '';
            }
        };

        $scope.selectedTopicName = function(topicId) {
            var topic = Indiggo.Utils.findByIdInList(topicId, $scope.meeting.agenda);
            if(angular.isObject(topic)) {
                return topic.name;
            } else {
                return "";
            }
        };

        /*
         * Get a merged list of actions and decisions, for the meeting's currently-selected topic.
         */
        $scope.topicActionsDecisions = function() {
            var combinedResult = [], topicActions, topicDecisions;
            if($scope.meeting.$resolved) {
                topicActions = $filter('filter')($scope.meeting.actions, $scope.meetingTopicActionComparator);
                topicDecisions = $scope.meeting.selectedTopic.decisions;

                combinedResult = topicActions.concat(topicDecisions);
            }
            return combinedResult;

        };

        $scope.topicHasNotes = function(notes) {
            return _.some(notes, function(note) {
                return angular.isString(note.content) && note.content.length > 0;
            });
        };

        $scope.updateTopic = function(topicData, topic) {
            // Update existing Topic, to update postponed state.
            if(angular.isObject(topic)) {
                topic.postponed = topicData.postponed;
                topic.creator = topicData.postponed?$rootScope.authenticatedUser:null;
                // Fix up topic selection, if postponing the selected topic.
                if(topic.postponed && $scope.meeting.selectedTopic.id == topic.id) {
                    var index = $scope.meeting.agenda.indexOf(topic),
                        selectionTopic = null;
                    if(index > 0) {
                        selectionTopic = $scope.meeting.agenda[index - 1];
                    } else if($scope.meeting.agenda.length > 0) {
                        selectionTopic = $scope.meeting.agenda[index + 1];
                    }
                    if(angular.isObject(selectionTopic)) {
                        $scope.meeting.selectedTopic = selectionTopic;
                    }
                }
            }
        };

        $scope.indexOfTopic = function(topic) {
            var index = _.chain($scope.meeting.agenda).pluck("id").indexOf(topic.id).value();
            return index
        };

        $scope.meetingTopicActionComparator = function(action,index){
            var result =
                angular.isObject($scope.meeting.selectedTopic) &&
                    angular.isObject(action) &&
                    angular.isString(action.topicId) &&
                    (angular.equals(action.topicId, $scope.meeting.selectedTopic.id));
            return result;
        };

        /*
         * Add a decision to the list of meeting decisions.
         * Show a modal dialog, send websocket message from
         * the dialog handler.
         */
        $scope.editDecision = function(decision) {
            var editScope = $scope.$new();
            editScope.decision = angular.isObject(decision)?angular.copy(decision):{};
            editScope.MeetingService = MeetingService;

            // Decision new or updated, will always be associated with the selected topic.
            var topic = $scope.meeting.selectedTopic;
            if(angular.isObject(topic)) {
                editScope.decision.topicId = topic.id;
            }
            // show the dialog.
            var modalInstance = ModalService.createModal({
                    templateUrl: 'partials/decisionForm.html',
                    size: 'sm',
                    scope: editScope
                },
                function (decision) {
                    // Set the createdDate, if not set.
                    if(!angular.isNumber(decision.createdDate)) {
                        decision.createdDate = new Date().getTime();
                    }
                    // Check for a decision.decidedBy value that is an email address instead of a UserProfile object.
                    if(!angular.isObject(decision.decidedBy)) {
                        decision.decidedBy = {email: decision.decidedBy};
                    }

                    var topicId = decision.topicId;
                    delete decision.topicId;
                    MessageQService.publishDecisionChangeEvent(Constants.meeting.event.DECISION_UPDATE, decision, {topicId: topicId, meetingId: $scope.meeting.id});
                    editScope.$destroy();
                },
                function () {
                    // Modal cancelled.
                    editScope.$destroy();
                });
        };

        $scope.deleteDecision = function(decision) {
            MessageQService.publishDecisionChangeEvent(Constants.meeting.event.DECISION_DELETE, decision, {topicId: decision.topicId, meetingId: $scope.meeting.id});
        };

        $scope.onDecideMethodChange = function(decision) {
            if(!angular.equals(Constants.meeting.purposeMethod.decide.individual, decision.method)) {
                decision.decidedBy = null;
            }
        };
        /*
         * Add an Action to the list of meeting actions.
         * Show a modal dialog, send websocket message from
         * the dialog handler.
         */
        $scope.editAction = function(action, isPreMeeting, meeting) {
            if(!angular.isObject(action)) {
                action = {classname: 'Action'};
            }
            MeetingService.editAction($scope, action, isPreMeeting, meeting);
        };

        $scope.getUsers = function(viewValue) {
            return $http.get('/api/user-profiles', {params:{q:viewValue}}).then(
                function(response){
                    return response.data;
                });
        };

        /*
         * Handler for postponed topic drag-and-drop.
         */
        $scope.onPostponedTopicDropComplete = function(event, data, postponed){
            // console.log('onDropComplete: ' + data + ":" + ($scope.isMeetingOwner()));
            if ($scope.isMeetingOwner()){
                data.creator = postponed?$rootScope.authenticatedUser:null;
                MessageQService.publishTopicPostponedEvent(Constants.meeting.event.TOPIC_POSTPONED, data, {meetingId: $scope.meeting.id});
            }
        };

        $scope.getRemainingMeetingTime = function(meeting, serverTime) {
            var resultDate = new Date(0,0,0,0,0,0,0);
            if(serverTime >= meeting.endDate) {
                return resultDate;
            } else {
                var endDate = new Date(meeting.endDate),
                    calcStartDate = new Date(Math.max(serverTime, meeting.startDate)),
                    hours = (endDate.getDate() - calcStartDate.getDate())*24 +
                        (endDate.getHours() - calcStartDate.getHours()),
                    mins = endDate.getMinutes() - calcStartDate.getMinutes();
                resultDate.setHours(hours);
                resultDate.setMinutes(mins);
                return resultDate;
            }
        };

    }]
);

meetingControllers.controller('MeetingDocumentCtrl', ['$scope', 'MeetingDocument',
    function($scope, MeetingDocument) {
        $scope.meetingDocumentList = MeetingDocument.query($scope.meeting.id);
    }]
);


/*
 * Helper functions
 */

meetingControllers.messageFromJson = function(message) {
    var messageBodyObject = angular.fromJson(message.body);
    if(messageBodyObject.payload) {
        // Message was manipulated by the server application.
        message.headers = messageBodyObject.headers;
        message.body = messageBodyObject.payload;
    } else {
        // Message is from a client peer.
        message.body = messageBodyObject;
    }
    return message;
};

meetingControllers.controller('FooterCtrl', ['$scope','$window',
    function($scope, $window) {
        $scope.goToTop = function() {
            $window.scrollTo(0, 0);
        };
    }]
);

meetingControllers.controller('RegistrationCtrl', ['$scope', '$http', '$location', '$modal', 'Registration', '$rootScope', '$stateParams', '$state',
    function ($scope, $http, $location, $modal, Registration, $rootScope, $stateParams, $state) {

        if ($stateParams.invitationToken != null) {
            var token = JSON.parse(atob($stateParams.invitationToken));
            $scope.invitationEmail = token.data.email;
        }

        $scope.validEmail = 0;
        $scope.validUsername = 0;

        //reintialize validEmail
        $scope.onChangeEmail = function () {
            $scope.validEmail = 0;
        };

        //reinitialize validUsername
        $scope.onChangeUsername = function() {
            $scope.validUsername = 0;
        }

        //Check for valid email on clicking on "Next" button only if the registration is done by clicking "Create a new account" from login page,
        //and not by accesing an invitation link received by email. In the second case, the email is valid by default
        $scope.registerStep1 = function () {

            var success = function (isValidEmail, status, headers, config) {
                if (isValidEmail) {
                    $scope.validEmail = 1;
                } else {
                    $scope.validEmail = -1;
                }
            };


            var error = function (data, status, headers, config) {

            };


            if (angular.isUndefined($scope.invitationEmail)) {
                Registration.isEmailAvailable($scope.newCredentials).success(success).error(error);
            } else {
                $scope.validEmail = 1;
            }

        };

        //check is the username is valid (does not exist in database)
        $scope.registerStep2 = function () {
            var success = function (isValidUsername, status, headers, config) {
                if (isValidUsername) {
                    $scope.validUsername = 1;
                } else {
                    $scope.validUsername = -1;
                }

            };
            var error = function (data, status, headers, config) {

            };
            Registration.isUsernameAvailable($scope.newCredentials).success(success).error(error);

        };

        //register the user
        $scope.register = function () {
            var success = function (data, status, headers, config) {
                $location.path('/');
            };

            var error = function (data, status, headers, config) {

            };
            $scope.newCredentials.invitationToken = $stateParams.invitationToken;
            if (!angular.isUndefined($scope.invitationEmail)) {
                $scope.newCredentials.email = $scope.invitationEmail;
            }
            Registration.register($scope.newCredentials).success(success).error(error);

        }

        var verifySuccess = function (data, status, headers, config) {
            $scope.stickyType = data === "true" ? "success" : "expired";
        };
        var verifyError = function (data, status, headers, config) {
            $scope.stickyType = "error";
        };

        if (!angular.isUndefined($stateParams.token)) {
            Registration.verifyEmail($stateParams.token).success(verifySuccess).error(verifyError);
        }

        //resend verification email
        $scope.resendVerificationEmail = function () {
            Registration.resendVerificationEmail();
            angular.element('#igo-resend-container').html("An email with a new link was sent");
        }
    }]
);