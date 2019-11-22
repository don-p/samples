import {inject, NewInstance, Lazy, LogManager} from 'aurelia-framework';
import {Logger} from 'aurelia-logging';
import {json} from 'aurelia-fetch-client';
import {Router, NavigationInstruction} from 'aurelia-router';
import {EventAggregator} from 'aurelia-event-aggregator';
import {DialogService} from 'aurelia-dialog';
import {I18N} from 'aurelia-i18n';
import {Session, AuthResource} from './services/session';
import {DataService} from './services/dataService';
import {Utils} from './services/util';
import {FetchConfig, AuthService} from 'aurelia-auth';
import {ValidationRules, ValidationController, Rules, validateTrigger, Validator, ValidateResult} from 'aurelia-validation';


@inject(Session, Router, DataService, Utils, DialogService, I18N, NewInstance.of(ValidationController), AuthService, Validator, EventAggregator, LogManager)
export class Login {
  username: string = '';
  password: string = '';
  errorMessage: string;
  errorResult: ValidateResult;
  vResults: ValidateResult[];

  vRules: ValidationRules;

  mfaCode: string;
 
  navigationInstruction: NavigationInstruction;

  headers: {
        'X-Requested-With': 'Fetch',
        'origin':'*',
        'Accept': 'application/json',
        'Content-Type': 'application/json'
  };

  originalItem: any;
  credentials: any;

  loginPromise: Promise<any>;
  logger: Logger;


  constructor(private session: Session, private router: Router, private dataService: DataService, 
    private utils: Utils, private dialogService: DialogService, private i18n: I18N, private vController:ValidationController, 
    private authService: AuthService, private validator:Validator, private evt:EventAggregator) {
      
    this.logger = LogManager.getLogger(this.constructor.name);
    this.credentials = {username: '', password: ''};
    this.originalItem = {username: '', password: ''};
    const vRules = ValidationRules
      .ensure('username')
      .displayName(this.i18n.tr('login.emailAddr'))
      .required()
      .then()
      .email()
      .then()
      .ensure('password')
      .displayName(this.i18n.tr('login.password'))
      .required()
      .then()
      .minLength(6)
      .rules;
    this.vController.validateTrigger = validateTrigger.manual;
    Rules.set(this.credentials, vRules);
  }

  activate(params, routeConfig, navigationInstruction) {
    this.navigationInstruction = navigationInstruction;
    if(Object.keys(params).length !== 0) {
      this.errorMessage = this.utils.parseFetchError(params);
      this.errorResult = this.vController.addError(this.utils.parseFetchError({errorMessage: this.i18n.tr(this.errorMessage)}), this);
    }
    this.logger.debug(navigationInstruction);
  }

  bind(bindingContext: Object, overrideContext: Object) {
    this.logger.debug('Bind...');
  }

  attached() {
    let me = this;
    this.validator.validateObject(this).then(function(result) {
      me.vResults = result;
    })    
    this.originalItem = {username: this.username, password: this.password};

  }

  get isDirty() {
    return this.utils.$isDirty(this.originalItem, this.credentials);
  }

  get hasValidationErrors() {
    return Array.isArray(this.vController.errors) && this.vController.errors.length > 0;
  }

  clearError() {
    let me = this;
    this.logger.debug('clearError(): ' + this.errorResult);
    this.vResults = [];
    if(this.errorResult) {
      this.vController.removeError(this.errorResult);
      //delete this.errorResult;
    }
    this.vController.validate();
  }

  async login(): Promise<void> {

    var me = this;
    delete me.errorResult;
    me.loginPromise = this.dataService.login(this.credentials.username, this.credentials.password);
    return me.loginPromise
    .then((data:any) => {
      me.logger.debug(data);
      if(data && data!==null) {
        let auth = new AuthResource();
        auth.refresh_token = data.refresh_token;
        auth.member = data.member;
        me.session.auth = data;
        me.session.auth.isLoggedIn = true;

        me.authService['auth'].storage.set('auth', JSON.stringify(me.session.auth));
        auth.member.email = me.credentials.username;
        if(data.mfa.isRequired) {
          me.router.navigateToRoute('login-2');          
        } else {
          // Send event for successful authentication.
          me.evt.publish('authenticated', auth);      
        }
      } else {
        throw "Login(): Authentication failed."
      }
    }).catch(error => {
      me.errorResult = me.vController.addError(this.utils.parseFetchError({errorMessage: me.i18n.tr('error.badCredentials')}), this);
      me.originalItem = {username: me.credentials.username, password: me.credentials.password};
      me.logger.debug("Authentication failed."); 
      me.logger.debug(error); 
    });
  }

async loginConfirm(token): Promise<void> {
    // ensure fetch is polyfilled before we create the http client
    var me = this;
    var er = null;

    var mfaPromise = this.dataService.loginFactor2(token);
    mfaPromise
    // .then(response => response.json())
    .then(data => {
      // Send event for successful authentication.
      me.evt.publish('authenticated', data);      
      // Successfully validated confirmation code.
      // me.router.navigateToRoute('community');
      //me.router.navigateToRoute('organization');
    })
    .catch(error => {
      er = error;
      error.json()
      .then(responseError => { 
        me.logger.debug("mfa token failed."); 
        me.logger.debug(er); 
        if(/*er.status === 400 && */responseError.error == 'INCORRECT_PARAMETER') {
          me.errorMessage = me.i18n.tr('error.invalidConfirmationCode');
        } else {
      // DEBUG
          // me.router.navigateToRoute('community');
          me.router.navigateToRoute('/');
    // DEBUG
        }
      })
    });

  }



}

