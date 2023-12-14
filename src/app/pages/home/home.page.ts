import { Component, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { IonRefresher } from '@ionic/angular';
import { ContentSrc, PlayerType} from '../../../app/appConstants';
import { AppHeaderService, CachingService, PreprocessorService } from '../../../app/services';
import { Share } from "@capacitor/share";
import { ContentService } from 'src/app/services/content/content.service';
import { PlaylistService } from 'src/app/services/playlist/playlist.service';
import { ConfigService } from '../../../app/services/config.service';
import { SunbirdPreprocessorService } from '../../services/sources/sunbird-preprocessor.service';
import { ModalController } from '@ionic/angular';
import { LangaugeSelectComponent } from 'src/app/components/langauge-select/langauge-select.component';
import { Filter, Language, MappingElement, MetadataMapping, SourceConfig } from 'src/app/services/config/models/config';
import { Content } from 'src/app/services/content/models/content';
import { SheetModalComponent } from 'src/app/components/sheet-modal/sheet-modal.component';
import { NetworkService } from 'src/app/services/network.service';
import { AddToPitaraComponent } from 'src/app/components/add-to-pitara/add-to-pitara.component';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { OnTabViewWillEnter } from 'src/app/tabs/on-tabs-view-will-enter';


@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss']
})
export class HomePage implements OnInit, OnTabViewWillEnter {
  refresh: boolean = false;
  showSheenAnimation: boolean = true;
  // contents!: Array<Content>
  contentList: Array<any> = [
    {
      source: 'sunbird',
      sourceType:'Diksha',
      metaData: {
        identifier: 'do_123',
        name: '',
        thumbnail: '',
        description: '',
        mimeType: '',
        url: '',
        focus: '',
        keyword: '',
      }
  
    }
  ]

  contents!: Array<ContentSrc>;
  filters!: Array<Filter>
  languages!: Array<Language>
  isOpen: boolean = false;
  configContents!: Array<any>;
  optModalOpen: boolean = false;
  @ViewChild('refresher', { static: false }) refresher!: IonRefresher;
  networkConnected: boolean = false;
  constructor(
    private headerService: AppHeaderService,
    private router: Router,
    private contentService: ContentService,
    private playListService: PlaylistService,
    private configService: ConfigService,
    private sunbirdProcess: SunbirdPreprocessorService,
    private preprocessor: PreprocessorService,
    private modalCtrl: ModalController,
    private networkService: NetworkService,
    private cacheService: CachingService,
    private domSanitiser: DomSanitizer) {
    this.configContents = [];
    // this.contentService.saveContents(this.contentList)
    this.networkService.networkConnection$.subscribe(ev => {
      console.log(ev);
      this.networkConnected = ev;
    })
  }

  async ngOnInit(): Promise<void> {  
    this.preprocessor.sourceProcessEmitted$.subscribe(async (content: any) => {
      console.log('content form preprocessor ', content);
      await this.contentService.deleteAllContents()
      this.contentService.saveContents(content).then()
      if(content.length > 0) {
        this.showSheenAnimation = false;
        content.forEach((ele: any) => {
          this.configContents.push(ele)
        });
        console.log("configContents ", this.configContents);
      }
    })
    this.networkConnected = await this.networkService.getNetworkStatus()
    let forceRefresh = await this.cacheService.getCacheTimeout();
    if(forceRefresh) {
      this.getServerMetaConfig();
    } else if(!this.networkConnected) {
      this.showSheenAnimation = false;
      this.configContents = [];
      this.configContents = await this.contentService.getAllContent();
      if (this.configContents.length == 0) this.getServerMetaConfig();
    } else {
      this.getServerMetaConfig();
    }
  }

  async getServerMetaConfig() {
    let config = await this.configService.getConfigMeta();
    this.initialiseSources(config.sourceConfig, config.metadataMapping);
    this.filters = config.filters.sort((a: Filter, b: Filter) => a.index - b.index);
    this.languages = config.languages.sort((a: Language, b: Language) => a.identifier.localeCompare(b.identifier));
    this.headerService.filterEvent({filter: this.filters, languages: this.languages});
  }

  async tabViewWillEnter() {
    await this.headerService.showHeader('', false);
  }

  async ionViewWillEnter() {
    this.headerService.showHeader('Title', false);
  }

  async moreOtions(content: any) {
    let modal: any;
    if(!this.optModalOpen) {
      this.optModalOpen = true;
      modal = await this.modalCtrl.create({
        component: SheetModalComponent,
        componentProps: {
          content: content
        },
        cssClass: 'sheet-modal',
        breakpoints: [0.3],
        showBackdrop: false,
        initialBreakpoint: 0.3,
        handle: false,
        handleBehavior: "none"
      });
      await modal.present();
    }

    modal.onDidDismiss().then((result: any) => {
      this.optModalOpen = false;
      if(result.data && result.data.type === 'addToPitara') {
         this.addContentToMyPitara(result.data.content || content)
      }
    });
  }

  initialiseSources(sourceConfig: SourceConfig, mapping: MetadataMapping) {
    const mappingList = mapping.mappings;
    if(sourceConfig.sources && sourceConfig.sources.length > 0) {
      sourceConfig.sources.forEach((config: any) => {
        if(config.sourceType == 'sunbird') {
        const mappingElement: MappingElement | undefined  = mappingList.find((element) => element.sourceType == 'sunbird') ;
          this.sunbirdProcess.process(config, mappingElement);
        }
      });
    }
  }

  async playContent(event: Event, content: Content) {
    this.contentService.markContentAsViewed(content)
    if(content.metaData.mimeType !== PlayerType.YOUTUBE) {
      await this.router.navigate(['/player'], {state: {content}});
    }
  }

  contentLiked(event: Event, content: ContentSrc) {
    if(event) {
      content.liked = true;
    }
  }

  async shareContent(event: Event, content: ContentSrc) {
    if((await Share.canShare()).value) {
      Share.share({text: content.name});
    }
  }

  async addContentToMyPitara(content: ContentSrc) {
    const modal = await this.modalCtrl.create({
      component: AddToPitaraComponent,
      componentProps: {
        content
      },
      cssClass: 'add-to-pitara',
      breakpoints: [0, 1],
      showBackdrop: false,
      initialBreakpoint: 1,
      handle: false,
      handleBehavior: "none"
    });
    await modal.present();
    modal.onWillDismiss().then((result) => {
    });
  }

  doRefresh(refresher: any) {
    this.refresh = true;
    this.getServerMetaConfig();
    setTimeout(() => {
      this.refresh = false;
      if (refresher) {
        refresher.detail.complete();
      }
    }, 100);
  }

  handleFilter(filter: any) {
    alert('handle filter '+  filter);
  }

  sanitiseUrl(url: string): SafeResourceUrl {
    return this.domSanitiser.bypassSecurityTrustResourceUrl(url.replace('watch?v=', 'embed/')+'?controls=1');
  }
}
