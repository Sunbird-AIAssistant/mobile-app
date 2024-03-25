import { Component, OnInit } from '@angular/core';
import { AppHeaderService, BotApiService } from '../../../app/services';
import { Router } from '@angular/router';
import { OnTabViewWillEnter } from 'src/app/tabs/on-tabs-view-will-enter';
import { TelemetryGeneratorService } from 'src/app/services/telemetry/telemetry.generator.service';
import { ModalController } from '@ionic/angular';

@Component({
  selector: 'app-story',
  templateUrl: 'story.page.html',
  styleUrls: ['story.page.scss']
})
export class StoryPage implements OnInit, OnTabViewWillEnter {
  config: any;
  cdata: any;
  duration: any;
  botStartTimeStamp: any;
  storyBotMsg = [];
  storyBot = false;
  constructor(private headerService: AppHeaderService,
    private router: Router,
    private telemetry: TelemetryGeneratorService,
    private messageApi: BotApiService,
    private modalCtrl: ModalController) {}
    
    ngOnInit() {
      this.config = {type: 'story'}
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
      this.storyBot = true
      this.config = {type: 'story', disable: this.storyBot}
      this.headerService.showHeader("Katha Sakhi", true, ['bot']);
      this.headerService.showStatusBar(false, '#CF4147');
      this.botStartTimeStamp = Date.now();
    }

    handleBotEvent(event?: any) {
      this.storyBotMsg = event.msg
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
      this.storyBot = false;
      this.telemetry.generateEndTelemetry('bot', 'end', 'story-sakhi', 'story-sakhi', undefined, undefined, undefined, this.duration, this.cdata);
      this.router.navigate(['/tabs/home']);
    }
}
