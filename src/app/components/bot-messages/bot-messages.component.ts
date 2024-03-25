import { AfterViewInit, Component, ElementRef, EventEmitter, Input, NgZone, OnInit, Output, ViewChild } from '@angular/core';
import { IonContent, ModalController } from '@ionic/angular';
import { BotMessage } from 'src/app/appConstants';
import { AppHeaderService, BotApiService, RecordingService, StorageService } from 'src/app/services';
import { Keyboard } from "@capacitor/keyboard";
import { Directory, Filesystem } from '@capacitor/filesystem';
import { TranslateService } from '@ngx-translate/core';
import { VoiceRecorder } from 'capacitor-voice-recorder';
import { TelemetryGeneratorService } from 'src/app/services/telemetry/telemetry.generator.service';
import { CorrelationData } from 'src/app/services/telemetry/models/telemetry';
import { ChatMessage } from 'src/app/services/bot/db/models/chat.message';
import { v4 as uuidv4 } from "uuid";
import { BotPermissionComponent } from '../bot-permission/bot-permission.component';
import { Router } from '@angular/router';

@Component({
  selector: 'app-bot-messages',
  templateUrl: './bot-messages.component.html',
  styleUrls: ['./bot-messages.component.scss'],
})
export class BotMessagesComponent  implements OnInit, AfterViewInit {
  botMessages: Array<any> = [];
  textMessage: string = ''
  chat!: BotMessage;
  defaultLoaderMsg!: BotMessage;
  @Input() config: any = {};
  @Output() botMessageEvent = new EventEmitter();
  @ViewChild('recordbtn', { read: ElementRef }) recordbtn: ElementRef | any;
  @ViewChild(IonContent, { static: true }) private content: any;
  navigated: boolean = false
  startRecording: boolean = false;
  duration = 0;
  durationDisplay = '';
  disabled = false;
  audioRef!: HTMLAudioElement;
  perModalOpen: boolean = false;
  constructor(
    private record: RecordingService,
    private ngZone: NgZone,
    private messageApi: BotApiService,
    private translate: TranslateService,
    private telemetryGeneratorService: TelemetryGeneratorService,
    private storage: StorageService,
    private modalCtrl: ModalController,
    private router: Router,
    private headerService: AppHeaderService
  ) { 
    this.defaultLoaderMsg = {identifier: "", message: this.translate.instant('Loading...'), messageType: 'text', displayMsg: this.translate.instant('Loading...'), type: 'received', time: '', timeStamp: '', readMore: false, likeMsg: false, dislikeMsg: false, requestId: ""};
    this.botMessages = [];
    this.audioRef = new Audio();
  }

  ngOnInit() {
    Keyboard.addListener('keyboardWillShow', () => {
      console.log('keyboard will show');
      this.content.scrollToBottom();
    })
    this.record.startEndEvent$.subscribe((res: any) => {
      this.ngZone.run(() => {
        this.startRecording = res;
        this.calculation();
      })
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        if(this.audioRef) {
          this.botMessages.forEach(msg => {
            if(msg.audio) {
              msg.audio.play = false;
            }
          })
          this.audioRef.pause();
        }
      }
    });
  }

  async checkBotPermission() {
    if (!this.perModalOpen) {
      this.perModalOpen = true
      const modal = await this.modalCtrl.create({
        component: BotPermissionComponent,
        componentProps: {
          type: this.config.type
        },
        cssClass: 'add-to-pitara',
        breakpoints: [0, 1],
        showBackdrop: false,
        backdropDismiss: false,
        initialBreakpoint: 1,
        handle: false,
        handleBehavior: "none"
      });
      await modal.present();
      await modal.onDidDismiss().then((res) => {
        this.perModalOpen = false;
        if(res.data.type === "decline") {
          this.telemetryGeneratorService.generateInteractTelemetry('CLICK', 'decline-bot', 'bot-message', 'bot-message');
          this.router.navigate(['/tabs/home']);
        }
        this.telemetryGeneratorService.generateInteractTelemetry('CLICK', 'accept-bot', 'bot-message', 'bot-message');
      })
    }
  }

  async ngOnChanges() {
    console.log('ng onchanges ', this.config);
    if(this.config.disable) {
      this.disabled = false
    }
    this.headerService.deviceBackbtnEmitted$.subscribe((ev: any) => {
      if(ev.name == 'backBtn') {
        if(this.modalCtrl) {
          this.modalCtrl.dismiss({type: 'decline'})
        }
        this.handleBackNavigation()
      }
    })

    this.headerService.headerEventEmitted$.subscribe((name: any) => {
      if(name == 'back') {
        this.handleBackNavigation()
      }
    })
    if(await this.storage.getData(this.config.type) === 'false') {
      this.checkBotPermission();
    }
    this.initialiseBot();
    if (this.config?.notification && this.config?.notif?.body) {
      this.textMessage = this.config.notif.body;
      this.disabled = false;
      this.handleMessage();
    }
  }

  ionViewWillEnter() {
    this.botMessages = [];
    this.navigated = false;
  }

  ngAfterViewInit(): void {
    this.record.gestureControl(this.recordbtn);
  }

  handleBackNavigation() {
    if (this.botMessages.length > 0) {
      this.botMessages.forEach(msg => {
        if (msg.messageType == 'audio') {
          if(this.audioRef) {
            if(msg.audio) {
              msg.audio.play = false;
            }
            this.audioRef.pause();
          }
        }
      });
    }
  }

  async initialiseBot() {
    this.botMessages = [];
    let textMsg = `WELCOME_TO_${this.config.type.toUpperCase()}_SAKHI`;
    if(this.botMessages.length === 0)
    this.botMessages.push({ messageType: 'text', displayMsg: textMsg, type: 'received'})
    this.content.scrollToBottom(300).then(() => {
      this.content.scrollToBottom(300)
    });
    await this.messageApi.getAllChatMessages(this.config.type).then((res) => {
      console.log('Bot response', res);
      res.forEach(chat => {
        let msg = {identifier: "", message: '', messageType: '', type: '', displayMsg: "", audio: { file: '', duration: '', play: false }, time: new Date().toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }), timeStamp: '', readMore: false, likeMsg: false, dislikeMsg: false, requestId: ""}
        msg.message = chat.message
        msg.identifier = chat.identifier
        if(chat.message.length > 200 && (chat.message.length - 200 > 100)) {
          msg.displayMsg = chat.message.substring(0, 200);
          msg.readMore = true;
        } else {
          msg.displayMsg = chat.message.substring(0, 200);
          msg.readMore = false;
        }
        msg.messageType = chat.messageType
        msg.type = chat.fromMe === 0 ? 'received' : 'sent'
        msg.time = new Date(JSON.parse(chat.ts)).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })
        msg.timeStamp = chat.ts
        msg.requestId = chat.requestId ?? ""
        msg.likeMsg = chat.reaction == 1
        msg.dislikeMsg = chat.reaction == 0
        if (chat.messageType == 'audio') {
          msg.audio.file = msg.type == 'sent' ? chat.mediaData : chat.mediaUrl
          msg.audio.duration = chat.duration ?? ""
        } 
        this.botMessages.push(msg);
      })
      console.log("botMessages ", this.botMessages);
    });
    this.botMessageEvent.emit({msg: this.botMessages})
    if(this.config.notif) {
      this.textMessage = this.config.notif.body;
      this.handleMessage();
    }
  }

  async handleMessage() {
    this.ngZone.run(() => {
      this.chat = {identifier: "", message: '', messageType: 'text', type: 'sent', displayMsg: "", time: new Date().toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }), timeStamp: '', readMore: false, likeMsg: false, dislikeMsg: false, requestId: ""}
      if (this.textMessage.replace(/\s/g, '').length > 0) {
        Keyboard.hide();
        this.chat.message = this.textMessage;
        this.chat.displayMsg = this.textMessage;
        this.chat.timeStamp = Date.now()
        this.botMessages.push(this.chat);
        this.saveChatMessage(this.chat);
        this.botMessageEvent.emit({msg: this.botMessages})
        this.content.scrollToBottom(300).then(() => {
          this.content.scrollToBottom(300)
        })
        this.botMessages = JSON.parse(JSON.stringify(this.botMessages));
        this.botMessages.push(this.defaultLoaderMsg);
        this.content.scrollToBottom(300).then(() => {
          this.content.scrollToBottom(300)
        })
      }
    })
    await this.makeBotAPICall(this.textMessage, '');
  }

  private saveChatMessage(message: BotMessage) {
    const chatMessage: ChatMessage = {
      identifier: uuidv4(),
      message: message.message,
      botType: this.config.type,
      fromMe: message.type == 'sent' ? 1 : 0,
      messageType: message.messageType,
      mediaMimeType: message.messageType,
      mediaData: (message.type == 'sent' && message.messageType == 'audio') ? message.audio.file : '',
      mediaUrl: (message.type == 'received' && message.messageType == 'audio') ? message.audio.file : '',
      duration: message.messageType == 'audio' ? message.audio.duration : '',
      requestId: message.requestId,
      ts: message.timeStamp,
      reaction: -1
    }
    this.messageApi.saveChatMessage(chatMessage).then();
  }

  async makeBotAPICall(text: string, audio: string) {
    this.textMessage = "";
    this.disabled = true;
    // Api call and response from bot, replace laoding text
    let index = this.botMessages.length;
    let lang = await this.storage.getData('lang');
    await this.messageApi.getBotMessage(text, audio, this.config.type, lang).then(result => {
    this.botMessages = JSON.parse(JSON.stringify(this.botMessages));
      this.botMessages.forEach(async (msg, i) => {
        if (result.responseCode === 200) {
          let data = result.body;
          if(i == index-1 && msg.type === 'received') {
            msg.time = new Date().toLocaleTimeString('en', {hour: '2-digit', minute:'2-digit'})
            msg.timeStamp = Date.now();
            msg.requestId = result.requestHeaders['X-Request-ID']
            if (data?.output) {
              this.disabled = false;
              msg.message = data.output?.text;
              if (data?.output?.text.length > 200 && (data?.output.text.length - 200 > 100)) {
                msg.displayMsg = data.output.text.substring(0, 200);
                msg.readMore = true;
              } else {
                msg.displayMsg = data.output?.text;
              }
              this.content.scrollToBottom(300).then(() => {
                this.content.scrollToBottom(300)
              })
              this.saveChatMessage(msg);
              if (data?.output?.audio) {
                let duration = await this.fetchAudioDuration(data.output.audio);
                console.log("duration ", duration);
                let audioMsg = {identifier: "", message: '', messageType: '', displayMsg: "", audio: { file: '', duration: '', play: false }, type: 'received', time: new Date().toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }), timeStamp: Date.now(), readMore: false, likeMsg: false, dislikeMsg: false, requestId: "" }
                audioMsg.audio = { file: data.output?.audio, duration: duration, play: false }
                audioMsg.messageType = 'audio';
                this.ngZone.run(() => {
                  this.botMessages.push(audioMsg);
                  this.saveChatMessage(audioMsg);
                  this.content.scrollToBottom(300).then(() => {
                    this.content.scrollToBottom(300).then()
                  });
                })
              }
              this.content.scrollToBottom(300).then(() => {
                this.content.scrollToBottom(300).then()
              });
            }
          }
        } else {
          msg.message = result.errorMesg ? result.errorMesg : result.data?.detail ? result.data.detail : "An unknown error occured, please try after sometime";
          msg.displayMsg = msg.message;
          msg.time = new Date().toLocaleTimeString('en', {hour: '2-digit', minute:'2-digit'});
          msg.timeStamp = Date.now();
          this.saveChatMessage(msg);
          this.disabled = false;
        }
      })
      this.botMessageEvent.emit({msg: this.botMessages})
    }).catch(e => {
      this.disabled = false;
      console.log('catch error ', e);
      this.botMessages[index-1].message = "An unknown error occured, please try after sometime";
      this.botMessages[index-1].displayMsg = "An unknown error occured, please try after sometime";
      this.botMessages[index-1].time = new Date().toLocaleTimeString('en', {hour: '2-digit', minute:'2-digit'});
      this.botMessages[index-1].timeStamp = Date.now();
      if(e.body.detail.length > 0) {
        if (e.body.detail[0].type === 'type_error.enum') {
          this.botMessages[index-1].message = "Sorry, this language is not currently supported.";
          this.botMessages[index-1].displayMsg = "Sorry, this language is not currently supported.";
        }
      }
      this.saveChatMessage(this.botMessages[index-1]);
      this.botMessageEvent.emit({msg: this.botMessages})
    })
  }

  readmore(msg: any) {
    let textDisplayed = msg.displayMsg;
    let prevLeng = msg.displayMsg.length
    if (msg.message !== textDisplayed) {
      if (msg.message.length < prevLeng + 200) {
        msg.displayMsg = textDisplayed + msg.message.substring(prevLeng, msg.message.length);
        msg.readMore = false;
      } else {
        msg.displayMsg = textDisplayed + msg.message.substring(prevLeng, prevLeng + 200);
        msg.readMore = true;
      }
      this.content.scrollToBottom(300).then(() => {
        this.content.scrollToBottom(300).then()
      });
    } else {
      msg.readMore = false;
    }
  }

  async playFile(msg: any) {
    let audio = msg.audio;
    let url = '';
    this.botMessages.forEach((audioMsg) => {
      if (audioMsg.audio?.play && msg.timeStamp !== audioMsg.timeStamp) {
        audioMsg.audio.play = false;
      }
    })
    if (msg.type === 'sent') {
      const audioFile = await Filesystem.readFile({
        path: audio.file,
        directory: Directory.Data
      });
      const base64Sound: any = audioFile.data;
      url = `data:audio/aac;base64,${base64Sound}`
      audio.play = !audio.play;
    } else if (msg.type === "received") {
      url = audio.file;
      audio.play = !audio.play;
    }
    this.audioRef.src = "";
    this.audioRef.src = url;
    this.audioRef.load();
    this.audioRef.preload = "auto"
    this.audioRef.controls = true;
    this.audioRef.oncanplaythrough = () => { 
      if(!audio.play) {
        this.audioRef.pause();
      } else {
        this.audioRef.play();
      }
    };
    this.audioRef.ondurationchange = (ev: Event) => {
      console.log("ondurationchange ", ev);
    }
    this.audioRef.ontimeupdate = (ev: Event) => {
      // this.audioRef.currentTime = (ev.target as any)?.currentTime
    }
    this.audioRef.onended = () => {audio.play = false; this.audioRef.pause();}
  }

  async cancelRecording() {
    console.log('cancel recording');
    await this.record.stopRecognition('audio').then(res => {
      console.log('res on recorded data ', res);
    });
    this.startRecording = false;
  }

  calculation() {
    if (!this.startRecording) {
      this.duration = 0;
      this.durationDisplay = '';
      return;
    }

    this.duration += 1;
    const min = Math.floor(this.duration / 60);
    const sec = (this.duration % 60).toString().padStart(2, '0');
    this.durationDisplay = `${min}:${sec}`;

    setTimeout(() => {
      this.calculation();
    }, 1000);
  }

  async onLongPressStart() {
    console.log('long press start');
    if(await (await VoiceRecorder.hasAudioRecordingPermission()).value) {
      this.record.startRecognition('');
    } else {
      await VoiceRecorder.requestAudioRecordingPermission();
    }
  }

  async onLongPressEnd() {
    console.log('long press end');
    await this.record.stopRecognition('audio').then(async result => {
      console.log('result on recorded data ', result);
      if(result?.value?.recordDataBase64) {
        this.chat = {identifier: "", message: '', messageType: '', displayMsg: "", audio: { file: '', duration: '', play: false }, type: 'sent', time: new Date().toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }), timeStamp: '', readMore: false, likeMsg: false, dislikeMsg: false, requestId: "" }
        const recordData = result.value.recordDataBase64;
        console.log('..................', result, this.durationDisplay);
        const fileName = new Date().getTime() + '.wav';
        await Filesystem.writeFile({
          path: fileName,
          directory: Directory.Data,
          data: recordData
        })
        this.ngZone.run(() => {
          this.chat.messageType = 'audio';
          this.chat.audio = { file: fileName, base64Data: recordData, duration: this.getTimeString(result.value.msDuration), play: false };
          this.chat.timeStamp = Date.now();
          this.botMessages.push(this.chat);
          this.saveChatMessage(this.chat);
          this.content.scrollToBottom(300).then(() => {
            this.content.scrollToBottom(300)
          })
          this.botMessages.push(this.defaultLoaderMsg);
          this.content.scrollToBottom(300).then(() => {
            this.content.scrollToBottom(300)
          })
        })
        this.makeBotAPICall('', recordData);
      }
    });
  }

  getTimeString(duration: any) {
    let minutes = Math.floor(duration / 1000 / 60);
    let seconds = Math.floor((duration / 1000) - (minutes * 60));
    return minutes.toString().padStart(2, '0') + ":" + seconds.toString().padStart(2, '0');
  }

  fetchAudioDuration(url: string): Promise<any> {
    const audioContext = new AudioContext(); 
    return fetch(url)
    .then(response => response.arrayBuffer())
    .then(buffer => audioContext.decodeAudioData(buffer)) 
    .then(audioBuffer => { 
      const duration = audioBuffer.duration; 
      console.log(`The audio file duration is ${duration} seconds`); 
      let minute = (Math.floor(duration/ 60)).toString().padStart(2, '0');
      let seconds = Math.floor(duration % 60).toString().padStart(2, '0');
      return minute + ':' + seconds;
    }).catch (e => {
      return '';
    }); 
  }

  msgLiked(msg: BotMessage, type: string) {
    this.botMessages.forEach((bot, index) => {
      if(msg.timeStamp == bot.timeStamp) {
        let reqId = {
          "id": msg.requestId,
          "type": "X-Request-ID"
        };
        let reqMsg = {
          "id": this.botMessages[index-1].message,
          "type": "Request"
        }
        let cdata: CorrelationData[] = [];
        cdata.push(reqId)
        if (this.botMessages[index-1].messageType == "text") cdata.push(reqMsg)
        if(type == 'like') {
          bot.likeMsg = true;
          bot.dislikeMsg = false;
          this.messageApi.updateMessageReactions(bot.identifier, 1);
          this.telemetryGeneratorService.generateInteractTelemetry('TOUCH', 'message-liked', "bot", `${this.config.type}-sakhi`, undefined, undefined, undefined, cdata);
        } else {
          msg.dislikeMsg = true;
          msg.likeMsg = false;
          this.messageApi.updateMessageReactions(bot.identifier, 0);
          this.telemetryGeneratorService.generateInteractTelemetry('TOUCH', 'message-disliked', "bot", `${this.config.type}-sakhi`, undefined, undefined, undefined, cdata);
        }
      }
    })
  }
}
