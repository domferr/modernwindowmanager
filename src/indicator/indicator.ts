import Gio from '@gi-types/gio2';
import St from '@gi-types/st1';
import { registerGObjectClass } from '@/utils/gjs';
import { getCurrentExtension, logger } from '@/utils/shell';
import { Actor, Margin, ActorAlign } from '@gi-types/clutter10';
import { Rectangle } from '@gi-types/meta10';
import { LayoutWidget } from '@/components/layout/LayoutWidget';
import { SnapAssistTile } from '@/components/snapassist/snapAssistTile';
import { Main, getMonitors, getScalingFactor } from '@/utils/ui';
import Settings from '@/settings';
import { Layout } from '@/components/layout/Layout';
import Tile from '@/components/layout/Tile';
import SignalHandling from '@/signalHandling';
import GlobalState from '@/globalState';
import { LayoutEditor } from '@/components/editor/layoutEditor';

const { PopupBaseMenuItem } = imports.ui.popupMenu;
const { Button: PopupMenuButton } = imports.ui.panelMenu;

const debug = logger('indicator');

@registerGObjectClass
export class LayoutSelectionWidget extends LayoutWidget<SnapAssistTile> {
    private static readonly _layoutHeight: number = 36;
    private static readonly _layoutWidth: number = 64; // 16:9 ratio. -> (16*this._layoutHeight) / 9 and then rounded to int

    constructor(layout: Layout, gapSize: number, scaleFactor: number) {
        const rect = new Rectangle({height: LayoutSelectionWidget._layoutHeight * scaleFactor, width: LayoutSelectionWidget._layoutWidth * scaleFactor, x: 0, y: 0});
        const gaps = new Margin({ top: gapSize * scaleFactor, bottom: gapSize * scaleFactor, left: gapSize * scaleFactor, right: gapSize * scaleFactor });
        super(null, layout, gaps, new Margin(), rect, "snap-assist-layout");
    }

    buildTile(parent: Actor, rect: Rectangle, gaps: Margin, tile: Tile): SnapAssistTile {
        return new SnapAssistTile({parent, rect, gaps, tile});
    }
}

@registerGObjectClass
export class Indicator extends PopupMenuButton {
    private icon: St.Icon;
    private layoutsBoxLayout: St.BoxLayout;
    private layoutsButtons: St.Button[] = [];
    private readonly _signals: SignalHandling;
    private _scalingFactor: number = 0;
    private _layoutEditor: LayoutEditor;

    constructor() {
        super(0.5, 'Modern Window Manager Indicator', false);
        this._signals = new SignalHandling();
        this.icon = new St.Icon({
            gicon: Gio.icon_new_for_string(`${getCurrentExtension().path}/icons/indicator.svg`),
            style_class: 'system-status-icon indicator-icon',
        });

        this.add_child(this.icon);

        //@ts-ignore
        let monitor = Main.layoutManager.findMonitorForActor(this);
        this._scalingFactor = getScalingFactor(monitor?.index || Main.layoutManager.primaryIndex);

        this.layoutsBoxLayout = new St.BoxLayout({
            x_align: ActorAlign.CENTER,
            y_align: ActorAlign.CENTER,
            x_expand: true,
            y_expand: true,
            vertical: false // horizontal box layout
        });
        const layoutsPopupMenu = new PopupBaseMenuItem({ style_class: 'popup-menu-layout-selection' });
        layoutsPopupMenu.add_actor(this.layoutsBoxLayout);
        this.menu.addMenuItem(layoutsPopupMenu);

        this._drawLayouts();
        // update the layouts shown by the indicator when they are modified
        this._signals.connect(Settings, Settings.SETTING_LAYOUTS_JSON, () => {
            this._drawLayouts();
        });

        const buttonsPopupMenu = this._buildEditingButtonsRow();
        this.menu.addMenuItem(buttonsPopupMenu);

        // if the selected layout was changed externaly, update the selected button
        this._signals.connect(Settings, Settings.SETTING_SELECTED_LAYOUTS, () => {
            const btnInd = Settings.get_selected_layouts()[imports.ui.main.layoutManager.primaryIndex];
            if (this.layoutsButtons[btnInd].checked) return;
            this.layoutsButtons.forEach((btn, layInd) => btn.set_checked(layInd === btnInd));
        });

        this._signals.connect(Main.layoutManager, 'monitors-changed', () => {
            //@ts-ignore
            let monitor = Main.layoutManager.findMonitorForActor(this);
            const newScalingFactor = getScalingFactor(monitor?.index || Main.layoutManager.primaryIndex);
            if (this._scalingFactor === newScalingFactor) return;

            this._scalingFactor = newScalingFactor;
            this._drawLayouts();
        });
    }

    private _buildEditingButtonsRow() {
        const buttonsBoxLayout = new St.BoxLayout({
            x_align: ActorAlign.CENTER,
            y_align: ActorAlign.CENTER,
            x_expand: true,
            y_expand: true,
            vertical: false, // horizontal box layout
            style: "spacing: 16px"
        });

        const editLayoutsBtn = this._createButton("document-edit-symbolic", "Edit Layouts...");
        editLayoutsBtn.connect('clicked', (self) => {            
            debug("Clicked the edit layouts button");
        });
        buttonsBoxLayout.add_child(editLayoutsBtn);
        const newLayoutBtn = this._createButton("list-add-symbolic", "New Layout...");
        newLayoutBtn.connect('clicked', (self) => {            
            debug("Clicked the new layout button");
            const newLayout = new Layout([
                new Tile({x: 0, y: 0, width: 0.11, height: 0.65}),
                new Tile({x: 0.33, y: 0, width: 0.67, height: 1}),
                new Tile({x: 0.11, y: 0, width: 0.22, height: 1}),
                new Tile({x: 0, y: 0.65, width: 0.11, height: 0.35}),
            ]);
            this._layoutEditor = new LayoutEditor(newLayout, Main.layoutManager.monitors[Main.layoutManager.primaryIndex]);
            this.menu.toggle();
        });
        buttonsBoxLayout.add_child(newLayoutBtn);

        const buttonsPopupMenu = new PopupBaseMenuItem({ style_class: 'popup-menu-layout-selection' });
        buttonsPopupMenu.add_actor(buttonsBoxLayout);
        return buttonsPopupMenu;
    }

    private _createButton(icon_name: string, text: string) : St.Button {
        const btn = new St.Button({ 
            style_class: "message-list-clear-button button default",
            can_focus: true,
            x_expand: false,
        });
        btn.child = new St.BoxLayout({
            x_align: ActorAlign.CENTER,
            y_align: ActorAlign.CENTER,
            x_expand: false,
            y_expand: true,
            vertical: false, // horizontal box layout
            style: "spacing: 8px",

        });
        btn.child.add_child(new St.Icon({ icon_name: icon_name, icon_size: 16, x_expand: false }));
        btn.child.add_child(new St.Label({ margin_bottom: 4, margin_top: 4, text: text, x_expand: false, yAlign: ActorAlign.CENTER }));
        return btn;
    }

    private _drawLayouts() {
        const layouts = GlobalState.get().layouts;
        const selectedIndex = Settings.get_selected_layouts()[imports.ui.main.layoutManager.primaryIndex]
        this.layoutsButtons.forEach(btn => btn.destroy());
        this.layoutsButtons = [];
        this.layoutsBoxLayout.remove_all_children();
        
        const hasGaps = Settings.get_inner_gaps(1).top > 0;

        this.layoutsButtons = layouts.map((lay, btnInd) => {
            const btn = new St.Button({style_class: "popup-menu-layout-button button"});
            btn.child = new LayoutSelectionWidget(lay, hasGaps ? 1:0, this._scalingFactor);
            this.layoutsBoxLayout.add_child(btn);
            btn.connect('clicked', (self) => {
                if (btn.checked) return;
                
                // change the layout of all the monitors
                Settings.save_selected_layouts_json(getMonitors().map((monitor) => btnInd));
                this.menu.toggle();
            });
            return btn;
        });

        this.layoutsButtons[selectedIndex].set_checked(true);
    }

    destroy() {
        this.layoutsButtons.forEach(btn => btn.destroy());
        this.layoutsButtons = [];
        this._signals.disconnect();
        super.destroy();
    }
}
