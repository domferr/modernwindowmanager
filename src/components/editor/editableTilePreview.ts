import { registerGObjectClass } from "@/utils/gjs";
import { TilePreview } from "../tilepreview/tilePreview";
import St from "@gi-types/st1";
import Clutter from "@gi-types/clutter10";
import Meta from "@gi-types/meta10";

@registerGObjectClass
export class EditableTilePreview extends TilePreview {
    private readonly _btn: St.Button;

    constructor(params: {
        parent?: Clutter.Actor,
        rect?: Meta.Rectangle,
        gaps?: Clutter.Margin
    }) {
        super(params);
        
        this._btn = new St.Button({
            style_class: "editable-tile-preview-button",
            x_expand: true
        });
        this.add_child(this._btn);
        this._btn.set_size(this.innerWidth, this.innerHeight);
        this._updateLabelText();
    }

    private _updateLabelText() {
        this._btn.label = `${this.innerWidth}x${this.innerHeight}`;
    }

    public updateSize(width: number, height: number) {
        this._rect.width = width;
        this._rect.height = height;
        this.set_size(this.innerWidth, this.innerHeight);
        this._btn.set_size(this.width, this.height);
        this._updateLabelText();
    }
    
    public updatePosition(x: number, y: number) {
        this._rect.x = x;
        this._rect.y = y;
        this.set_position(this.innerX, this.innerY);
    }

    public connectSignal(signal: "clicked", callback: (_source: this, clicked_button: number) => void): number {
        return this._btn.connect(signal, callback);
    }
}