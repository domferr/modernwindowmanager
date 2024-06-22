const node = 
`<node>
    <interface name="org.gnome.Shell.Extensions.TilingShell">
        <method name="openLayoutEditor" />
    </interface>
</node>`;

import Gio from "gi://Gio";

export default class DBus {
    private _dbus: Gio.DBusExportedObject | null;

    constructor() {
        this._dbus = null;
    }

    public enable() {
        if (this._dbus) return;

        this._dbus = Gio.DBusExportedObject.wrapJSObject(node, this);
    }

    public disable() {
        this._dbus?.flush();
        this._dbus?.unexport();
        this._dbus = null;
    }
}