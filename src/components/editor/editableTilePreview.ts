import { registerGObjectClass } from "@/utils/gjs";
import { TilePreview } from "../tilepreview/tilePreview";
import St from "@gi-types/st1";
import Clutter from "@gi-types/clutter10";
import Meta from "@gi-types/meta10";
import Tile from "../layout/Tile";

@registerGObjectClass
export class EditableTilePreview extends TilePreview {
    private readonly _btn: St.Button;
    private readonly _tile: Tile;

    constructor(params: {
        parent?: Clutter.Actor,
        rect?: Meta.Rectangle,
        gaps?: Clutter.Margin,
        tile: Tile
    }) {
        super(params);
        this._tile = params.tile;
        
        this._btn = new St.Button({
            style_class: "editable-tile-preview-button",
            x_expand: true
        });
        this.add_child(this._btn);
        this._btn.set_size(this.innerWidth, this.innerHeight);
        this._updateLabelText();
    }

    public get tile() : Tile {
        return this._tile;
    }

    private _updateLabelText() {
        this._btn.label = `${this.innerWidth}x${this.innerHeight}`;
    }

    public updateSize(width: number, height: number) {
        this._rect.width = Math.round(width);
        this._rect.height = Math.round(height);
        this.set_size(this.innerWidth, this.innerHeight);
        this._btn.set_size(this.width, this.height);
        this._updateLabelText();
    }
    
    public updatePosition(x: number, y: number) {
        this._rect.x = Math.round(x);
        this._rect.y = Math.round(y);
        this.set_position(this.innerX, this.innerY);
    }

    public connectSignal(signal: "clicked", callback: (_source: this, clicked_button: number) => void): number {
        return this._btn.connect(signal, callback);
    }
}