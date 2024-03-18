import { Layout } from "./components/layout/Layout";
import Settings from "./settings";
import SignalHandling from "./signalHandling";
import { registerGObjectClass } from "./utils/gjs";
import GObject, { MetaInfo } from "@gi-types/gobject2";

@registerGObjectClass
export default class GlobalState extends GObject.Object {
    static metaInfo: MetaInfo = {
        Signals: {
            "layouts-changed": { 
                param_types: []
            },
        },
        GTypeName: "GlobalState"
    }

    public static SIGNAL_LAYOUTS_CHANGED = "layouts-changed";

    private static _instance: GlobalState | null;
    
    private _signals: SignalHandling;
    private _layouts: Layout[];

    static get() : GlobalState {
        if (!this._instance) this._instance = new GlobalState();

        return this._instance;
    }

    static destroy() {
        if (this._instance) {
            this._instance._signals.disconnect();
            this._instance._layouts = [];
            this._instance = null;
        }
    }

    constructor() {
        super();

        this._signals = new SignalHandling();
        this._layouts = Settings.get_layouts_json();
        this._signals.connect(Settings, Settings.SETTING_LAYOUTS_JSON, () => {
            this._layouts = Settings.get_layouts_json();
            this.emit(GlobalState.SIGNAL_LAYOUTS_CHANGED);
        });
    }

    get layouts() : Layout[] {
        return this._layouts;
    }

    set layouts(layouts: Layout[]) {
        this._layouts = layouts;
        Settings.save_layouts_json(layouts);
        this.emit(GlobalState.SIGNAL_LAYOUTS_CHANGED);
    }
}