import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import SignalHandling from "@/signalHandling";
import Indicator from "./indicator";
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { enableScalingFactorSupport, getMonitors, getScalingFactor, getScalingFactorOf } from '@/utils/ui';
import Settings from '@/settings';
import * as IndicatorUtils from './utils';
import GlobalState from '@/globalState';
import CurrentMenu from './currentMenu';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import LayoutButton from './layoutButton';
import { logger } from '@utils/shell';
import { registerGObjectClass } from '@utils/gjs';
import Layout from '@components/layout/Layout';

const debug = logger("DefaultMenu");

@registerGObjectClass
class LayoutsRow extends St.BoxLayout {
    static metaInfo: GObject.MetaInfo<any, any, any> = {
        GTypeName: "LayoutsRow",
        Signals: {
            "selected-layout": { 
                param_types: [ GObject.TYPE_STRING ]
            },
        }
    }

    private _layoutsBox: St.BoxLayout;
    private _layoutsButtons: LayoutButton[];
    private _label: St.Label | null;

    constructor(parent: Clutter.Actor, layouts: Layout[], selectedId: string, title: string | null) {
        super({
            xAlign: Clutter.ActorAlign.CENTER,
            yAlign: Clutter.ActorAlign.CENTER,
            xExpand: true,
            yExpand: true,
            vertical: true,
            style: "spacing: 8px"
        });
        this._layoutsBox = new St.BoxLayout({
            xAlign: Clutter.ActorAlign.CENTER,
            yAlign: Clutter.ActorAlign.CENTER,
            xExpand: true,
            yExpand: true,
            vertical: false, // horizontal box layout
            styleClass: "layouts-box-layout"
        });

        this._label = null;
        if (title) {
            this._label = new St.Label({ text: title, styleClass: "monitor-layouts-title" });
            this.add_child(this._label);
        }
        this.add_child(this._layoutsBox);

        parent.add_child(this);
        
        const selectedIndex = layouts.findIndex(lay => lay.id === selectedId);
        const hasGaps = Settings.get_inner_gaps(1).top > 0;

        const layoutHeight: number = 36;
        const layoutWidth: number = 64; // 16:9 ratio. -> (16*layoutHeight) / 9 and then rounded to int

        this._layoutsButtons = layouts.map((lay, ind) => {
            const btn = new LayoutButton(this._layoutsBox, lay, hasGaps ? 2:0, layoutHeight, layoutWidth);
            btn.connect('clicked', (self) => !btn.checked && this.emit("selected-layout", lay.id));
            if (ind === selectedIndex) btn.set_checked(true);
            return btn;
        });
    }

    public selectLayout(selectedId: string) {
        const selectedIndex = GlobalState.get().layouts.findIndex(lay => lay.id === selectedId);
        this._layoutsButtons.forEach((btn, ind) => btn.set_checked(ind === selectedIndex));
    }
}

export default class DefaultMenu implements CurrentMenu {
    private readonly _signals: SignalHandling;
    private readonly _indicator: Indicator;

    private _layoutsRows: LayoutsRow[];
    private _container: St.BoxLayout;
    private _scalingFactor: number;
    private _children: St.Widget[];

    constructor(indicator: Indicator, enableScalingFactor: boolean) {
        this._indicator = indicator;
        this._signals = new SignalHandling();
        this._children = [];
        const layoutsPopupMenu = new PopupMenu.PopupBaseMenuItem({ style_class: 'indicator-menu-item' });
        this._children.push(layoutsPopupMenu);
        this._container = new St.BoxLayout({
            xAlign: Clutter.ActorAlign.CENTER,
            yAlign: Clutter.ActorAlign.CENTER,
            xExpand: true,
            yExpand: true,
            vertical: true,
            styleClass: "default-menu-container"
        });
        layoutsPopupMenu.add_child(this._container);
        (this._indicator.menu as PopupMenu.PopupMenu).addMenuItem(layoutsPopupMenu);

        if (enableScalingFactor) {
            const monitor = Main.layoutManager.findMonitorForActor(this._container);
            const scalingFactor = getScalingFactor(monitor?.index || Main.layoutManager.primaryIndex);
            enableScalingFactorSupport(this._container, scalingFactor);
        }
        this._scalingFactor = getScalingFactorOf(this._container)[1];

        this._layoutsRows = [];
        this._drawLayouts();
        // update the layouts shown by the indicator when they are modified
        this._signals.connect(Settings, Settings.SETTING_LAYOUTS_JSON, () => {
            this._drawLayouts();
        });
        this._signals.connect(Settings, Settings.SETTING_INNER_GAPS, () => {
            this._drawLayouts();
        });

        // if the selected layout was changed externaly, update the selected button
        this._signals.connect(Settings, Settings.SETTING_SELECTED_LAYOUTS, () => {
            this._updateScaling();
            if (this._layoutsRows.length !== getMonitors().length) {
                this._drawLayouts();
            }
            Settings.get_selected_layouts().forEach((selectedId, index) => {
                this._layoutsRows[index].selectLayout(selectedId);
            });
        });
        
        this._signals.connect(Main.layoutManager, 'monitors-changed', () => {
            if (!enableScalingFactor) return;

            const monitor = Main.layoutManager.findMonitorForActor(this._container);
            const scalingFactor = getScalingFactor(monitor?.index || Main.layoutManager.primaryIndex);
            enableScalingFactorSupport(this._container, scalingFactor);
        
            this._updateScaling();
            if (this._layoutsRows.length !== getMonitors().length) {
                this._drawLayouts();
            }
        });

        const buttonsPopupMenu = this._buildEditingButtonsRow();
        (this._indicator.menu as PopupMenu.PopupMenu).addMenuItem(buttonsPopupMenu);
        this._children.push(buttonsPopupMenu);
    }

    private _updateScaling() {
        const newScalingFactor = getScalingFactorOf(this._container)[1];
        if (this._scalingFactor === newScalingFactor) return;

        this._scalingFactor = newScalingFactor;
        this._drawLayouts();
    }

    private _buildEditingButtonsRow() {
        const buttonsBoxLayout = new St.BoxLayout({
            xAlign: Clutter.ActorAlign.CENTER,
            yAlign: Clutter.ActorAlign.CENTER,
            xExpand: true,
            yExpand: true,
            vertical: false, // horizontal box layout
            styleClass: "buttons-box-layout"
        });

        const editLayoutsBtn = IndicatorUtils.createButton("document-edit-symbolic", "Edit Layouts...");
        editLayoutsBtn.connect('clicked', (self) => this._indicator.openLayoutEditor() );
        buttonsBoxLayout.add_child(editLayoutsBtn);
        const newLayoutBtn = IndicatorUtils.createButton("add-symbolic", "New Layout...", this._indicator.path);
        newLayoutBtn.connect('clicked', (self) => this._indicator.newLayoutOnClick(true) );
        buttonsBoxLayout.add_child(newLayoutBtn);

        const buttonsPopupMenu = new PopupMenu.PopupBaseMenuItem({ style_class: 'indicator-menu-item' });
        buttonsPopupMenu.add_child(buttonsBoxLayout);
        
        return buttonsPopupMenu;
    }

    private _drawLayouts() {
        const layouts = GlobalState.get().layouts;
        this._container.destroy_all_children();
        this._layoutsRows = [];

        const selectedIdPerMonitor = Settings.get_selected_layouts();
        const monitors = getMonitors();
        this._layoutsRows = monitors.map((monitor, index) => {
            const selectedId = selectedIdPerMonitor[index];
            const title = monitors.length === 1 ? null:`Monitor ${index+1}`;
            const row = new LayoutsRow(this._container, layouts, selectedId, title);
            row.connect("selected-layout", (r: LayoutsRow, layoutId: string) => {
                this._indicator.selectLayoutOnClick(index, layoutId)
            });
            return row;
        });
    }

    public destroy() {
        this._signals.disconnect();
        this._children.forEach(c => c.destroy());
        this._children = [];
        this._layoutsRows = [];
    }
}