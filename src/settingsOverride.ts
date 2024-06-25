import Settings from '@settings';
import { logger } from '@utils/shell';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

const debug = logger("SettingsOverride");

export default class SettingsOverride {
    // map schema_id with map of keys and old values
    private _overriddenKeys: Map<string, Map<string, GLib.Variant>>;

    constructor() {
        this._overriddenKeys = this._jsonToOverriddenKeys(Settings.get_overridden_settings());
    }

    private _overriddenKeysToJSON(): string { // {"org.gnome.mutter.keybindings":{"toggle-tiled-right":"['<Super>Right']","toggle-tiled-left":"['<Super>Left']"},"org.gnome.desktop.wm.keybindings":{"maximize":"['<Super>Up']","unmaximize":"['<Super>Down', '<Alt>F5']"}}
        const obj: any = {};
        this._overriddenKeys.forEach((override, schemaId) => {
            obj[schemaId] = {};
            override.forEach((oldValue, key) => {
                debug(key)
                obj[schemaId][key] = `${oldValue.print(true)}`;
            });
        });
        return JSON.stringify(obj);
    };

    private _jsonToOverriddenKeys(json: string): Map<string, Map<string, GLib.Variant>> {
        const result = new Map();
        const obj: any = JSON.parse(json);
        debug(obj);
        for (const schemaId in obj) {
            const schemaMap = new Map();
            result.set(schemaId, schemaMap);

            const overrideObj = obj[schemaId];
            for (const key in overrideObj) {
                schemaMap.set(key, GLib.Variant.parse(null, overrideObj[key], null, null))
            }
        }

        return result;
    };

    public override(
        giosettings: Gio.Settings, 
        keyToOverride: string,
        newValue: GLib.Variant
    ): boolean {
        const schemaId = giosettings.schemaId;
        if (!this._overriddenKeys.has(schemaId)) {
            this._overriddenKeys.set(schemaId, new Map());
        }
        const oldValue = giosettings.get_value(keyToOverride);
        //@ts-ignore
        const res = giosettings.set_value(keyToOverride, newValue);
        if (res) {
            //@ts-ignore
            this._overriddenKeys.get(schemaId)?.set(keyToOverride, oldValue);

            Settings.set_overridden_settings(this._overriddenKeysToJSON());
        }
        return res;
    }

    public restoreKey(
        giosettings: Gio.Settings, 
        key: string
    ): boolean {
        const overridden = this._overriddenKeys.get(giosettings.schemaId);
        if (!overridden) return false;

        const oldValue = overridden.get(key);
        if (!oldValue) return false;

        //@ts-ignore
        const res = giosettings.set_value(keyToOverride, oldValue);

        if (res) {
            overridden.delete(key);
            if (overridden.size === 0) this._overriddenKeys.delete(giosettings.schemaId);

            Settings.set_overridden_settings(this._overriddenKeysToJSON());
        }

        return res;
    }
    
    private _restoreAllKeys(giosettings: Gio.Settings) {
        const overridden = this._overriddenKeys.get(giosettings.schemaId);
        if (!overridden) return;

        overridden.forEach((oldValue: GLib.Variant, key: string) => {
            //@ts-ignore
            giosettings.set_value(key, oldValue);
        });

        this._overriddenKeys.delete(giosettings.schemaId);
    }
    
    public restoreAll() {
        this._overriddenKeys.forEach((overridden: Map<string, GLib.Variant>, schemaId: string) => {
            this._restoreAllKeys(new Gio.Settings({ schemaId }));
        });
        this._overriddenKeys = new Map();

        Settings.set_overridden_settings(this._overriddenKeysToJSON());
    }
}