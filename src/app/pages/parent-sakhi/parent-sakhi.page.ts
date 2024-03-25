import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ModalController } from '@ionic/angular';
import { AppHeaderService, BotApiService, LocalNotificationService } from 'src/app/services';
import { TelemetryGeneratorService } from 'src/app/services/telemetry/telemetry.generator.service';
import { OnTabViewWillEnter } from 'src/app/tabs/on-tabs-view-will-enter';

@Component({
  selector: 'app-parent-sakhi',
  templateUrl: './parent-sakhi.page.html',
  styleUrls: ['./parent-sakhi.page.scss'],
})
export class ParentSakhiPage implements OnInit, OnTabViewWillEnter {
  config: any;
  cdata:  any;
  duration: any;
  notification: any;
  notifSubscription: any;
  botStartTimeStamp: any;
  parentBotMsg = [];
  parentBot = false;
  constructor(private headerService: AppHeaderService,
    private router: Router,
    private telemetry: TelemetryGeneratorService,
    private localNotification: LocalNotificationService,
    private messageApi: BotApiService,
    private modalCtrl: ModalController) {
      let extras = this.router.getCurrentNavigation()?.extras
      if(extras) {
        this.notification = extras?.state?.['notif'];
      }
    }

  ngOnInit() {
    this.parentBot = true
    this.config = this.notification ? {type: 'parent', notif: this.notification, disable: this.parentBot} : {type: 'parent', disable: true}
    this.headerService.deviceBackbtnEmitted$.subscribe((ev: any) => {
      console.log('bot message back event ', ev);
      if(ev.name == 'backBtn') {
        if(this.modalCtrl) {
          this.modalCtrl.dismiss({type: 'decline'})
        }
        this.handleBackNavigation();
      }
    })
    this.headerService.headerEventEmitted$.subscribe((name: any) => {
      console.log('bot message back event ');
      if(name == 'back') {
        this.handleBackNavigation();
      }
    })
  }
  
  tabViewWillEnter(): void {
    this.ionViewWillEnter();
  }
  
  ionViewWillEnter()  {
    this.parentBot = true
    this.config = this.notification ? {type: 'parent', notif: this.notification, disable: true} : {type: 'parent', disable: true};
    this.headerService.showHeader("Parent Tara", true, ['bot']);
    this.headerService.showStatusBar(false, '#FCB915');
    this.botStartTimeStamp = Date.now();
  }

  ngAfterViewInit() {
    this.parentBot = true
    this.notifSubscription = this.localNotification.notificationEventEmitted$.subscribe((notif: any) => {
      this.config = {type: 'parent', notif: notif, notification: true, disable: true}
    });
  }

  handleBotEvent(event?: any) {
    this.parentBotMsg = event.msg
  }

  async handleBackNavigation() {
    let botDuration = Date.now() - this.botStartTimeStamp;
    await this.messageApi.getAllChatMessages(this.config.type).then((res) => {
      let result = { audio: 0, text: 0 };
      if(res.length > 0) {
        console.log('Bot response', res);
        res.forEach(chat => {
          if (chat.messageType == 'text') {
            result.text++;
          } else if (chat.messageType == 'audio') {
            result.audio++;
          }
        });
        this.cdata = {
          "audioMessagesCount": result.audio,
          "textMessagesCount": result.text
        }
        this.duration = botDuration/1000;
      } else {
        this.cdata = {
          "audioMessagesCount": result.audio,
          "textMessagesCount": result.text
        }
      }
    })
    this.parentBot = false;
    this.telemetry.generateEndTelemetry('bot', 'end', 'parent-sakhi', 'parent-sakhi', undefined, undefined, undefined, this.duration, this.cdata); 
    this.router.navigate(['/tabs/home']);
  }
}
