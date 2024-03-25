import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ModalController } from '@ionic/angular';
import { AppHeaderService, BotApiService } from 'src/app/services';
import { TelemetryGeneratorService } from 'src/app/services/telemetry/telemetry.generator.service';
import { OnTabViewWillEnter } from 'src/app/tabs/on-tabs-view-will-enter';

@Component({
  selector: 'app-teacher-sakhi',
  templateUrl: './teacher-sakhi.page.html',
  styleUrls: ['./teacher-sakhi.page.scss'],
})
export class TeacherSakhiPage implements OnInit, OnTabViewWillEnter {
  config: any;
  cdata: any;
  duration: any;
  botStartTimeStamp: any;
  teacherBotMsg = [];
  teacherBot = false;
  constructor(private headerService: AppHeaderService,
    private router: Router,
    private telemetry: TelemetryGeneratorService,
    private messageApi: BotApiService,
    private modalCtrl: ModalController) {}

  ngOnInit() {
    this.config = {type: 'teacher'};
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
    this.teacherBot = true
    this.config = {type: 'teacher'}
    this.headerService.showHeader("Teacher Tara", true, ['bot']);
    this.headerService.showStatusBar(false, '#FCB915');
    this.botStartTimeStamp = Date.now();
  }

  handleBotEvent(event?: any) {
    this.teacherBotMsg = event.msg
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
    this.teacherBot = false;
    this.telemetry.generateEndTelemetry('bot', 'end', 'teacher-sakhi', 'teacher-sakhi', undefined, undefined, undefined, this.duration, this.cdata);
    this.router.navigate(['/tabs/home']);
  }
}
