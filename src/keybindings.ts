import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import Gio from 'gi://Gio';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import Settings from '@settings';

export default class OverrideSettings {
    // map schema_id with map of keys and old values
    private _overriddenKeys: Map<string, Map<string, any>> | null;

    constructor() {
        this._overriddenKeys = null;
    }

    public enable(
        giosettings: Gio.Settings, 
        _onKeyboardMoveWin: (display: Meta.Display, dir: Meta.Direction) => void
    ) {
        if (this._overriddenKeys) return;

        this._overriddenKeys = new Map();
        // Disable native keybindings for Super + Left/Right/Up/Down
        const mutterKeybindings = new Gio.Settings({
            schema_id: 'org.gnome.mutter.keybindings'
        });
        this._overrideKeyBinding(Settings.SETTING_MOVE_WINDOW_RIGHT, (display: Meta.Display) => {
            _onKeyboardMoveWin(display, Meta.Direction.RIGHT);
        }, giosettings, mutterKeybindings, "toggle-tiled-right");
        this._overrideKeyBinding(Settings.SETTING_MOVE_WINDOW_LEFT, (display: Meta.Display) => {
            _onKeyboardMoveWin(display, Meta.Direction.LEFT);
        }, giosettings, mutterKeybindings, "toggle-tiled-left");

        const desktopWm = new Gio.Settings({
            schema_id: 'org.gnome.desktop.wm.keybindings'
        });
        this._overrideKeyBinding(Settings.SETTING_MOVE_WINDOW_UP, (display: Meta.Display) => {
            _onKeyboardMoveWin(display, Meta.Direction.UP);
        }, giosettings, desktopWm, "maximize");
        this._overrideKeyBinding(Settings.SETTING_MOVE_WINDOW_DOWN, (display: Meta.Display) => {
            _onKeyboardMoveWin(display, Meta.Direction.DOWN);
        }, giosettings, desktopWm, "unmaximize");
        
        const mutter = new Gio.Settings({
            schema_id: 'org.gnome.mutter'
        });
        this._trackOldValue(mutter.schema_id, 'edge-tiling', mutter.get_boolean('edge-tiling'));
        mutter.set_boolean('edge-tiling', false);
    }

    private _overrideKeyBinding(
        name: string, 
        handler: Meta.KeyHandlerFunc, 
        gioSettings: Gio.Settings, 
        nativeSettings: Gio.Settings, 
        nativeKeyName: string
    ) {
        if (!this._overriddenKeys) return;

        if (nativeSettings.get_strv(nativeKeyName).includes(gioSettings.get_strv(name)[0])) {
            this._trackOldValue(nativeSettings.schema_id, nativeKeyName, nativeSettings.get_strv(nativeKeyName));
            nativeSettings.set_strv(nativeKeyName, []);
        }

        Main.wm.addKeybinding(
            name,
            gioSettings,
            Meta.KeyBindingFlags.NONE,
            Shell.ActionMode.NORMAL,
            handler
        );
    }

    private _trackOldValue(schemaId: string, key: string, oldValue: any) {
        if (!this._overriddenKeys) return;

        if (!this._overriddenKeys.has(schemaId)) {
            this._overriddenKeys.set(schemaId, new Map());
        }
        this._overriddenKeys.get(schemaId)?.set(key, oldValue);
    }

    public disable() {
        Main.wm.removeKeybinding(Settings.SETTING_MOVE_WINDOW_RIGHT);
        Main.wm.removeKeybinding(Settings.SETTING_MOVE_WINDOW_LEFT);
        Main.wm.removeKeybinding(Settings.SETTING_MOVE_WINDOW_UP);
        Main.wm.removeKeybinding(Settings.SETTING_MOVE_WINDOW_DOWN);

        if (this._overriddenKeys) {
            // Enable back native keybindings for Super + Left/Right/Up/Down
            const mutterKeybindings = new Gio.Settings({
                schema_id: 'org.gnome.mutter.keybindings'
            });
            const desktopWm = new Gio.Settings({
                schema_id: 'org.gnome.desktop.wm.keybindings'
            });

            this._overriddenKeys.get(mutterKeybindings.schema_id)?.forEach((oldValue: string[], key: string) => {
                mutterKeybindings.set_strv(key, oldValue);
            });
            this._overriddenKeys.get(desktopWm.schema_id)?.forEach((oldValue: string[], key: string) => {
                desktopWm.set_strv(key, oldValue);
            });

            const mutter = new Gio.Settings({
                schema_id: 'org.gnome.mutter'
            });
            if (this._overriddenKeys.get(mutter.schemaId)) {
                const oldValue = this._overriddenKeys.get(mutter.schemaId)?.get('edge-tiling');
                mutter.set_boolean('edge-tiling', oldValue);
            }
            this._overriddenKeys.get(desktopWm.schema_id)?.forEach((oldValue: string[], key: string) => {
                desktopWm.set_strv(key, oldValue);
            });
        }
    }
}