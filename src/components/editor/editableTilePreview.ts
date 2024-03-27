import { registerGObjectClass } from "@/utils/gjs";
import { TilePreview } from "../tilepreview/tilePreview";
import St, { Side } from "@gi-types/st1";
import Clutter from "@gi-types/clutter10";
import Meta, { Rectangle } from "@gi-types/meta10";
import Tile from "../layout/Tile";
import { Slider } from "./slider";
import TileUtils from "../layout/TileUtils";
import { logger } from "@/utils/shell";

const debug = logger("EditableTilePreview");

@registerGObjectClass
export class EditableTilePreview extends TilePreview {
    public static MIN_TILE_SIZE: number = 140;

    private readonly _btn: St.Button;
    private readonly _tile: Tile;
    private readonly _containerRect: Rectangle;

    private _sliders: (Slider | null)[];

    constructor(params: {
        tile: Tile,
        containerRect: Rectangle,
        parent?: Clutter.Actor,
        rect?: Meta.Rectangle,
        gaps?: Clutter.Margin
    }) {
        super(params);
        this.set_can_focus(true);
        this.set_reactive(true);
        this._tile = params.tile;
        this._containerRect = params.containerRect;
        this._sliders = [null, null, null, null];

        this._btn = new St.Button({
            style_class: "editable-tile-preview-button",
            x_expand: true
        });
        this.add_child(this._btn);
        this._btn.set_size(this.innerWidth, this.innerHeight);
        this._btn.set_button_mask(St.ButtonMask.ONE | St.ButtonMask.THREE);
        this._updateLabelText();
    }

    public get tile() : Tile {
        return this._tile;
    }

    public getSliderBySide(side: Side) : Slider | null {
        return this._sliders[side];
    }

    public get sliders() : (Slider | null)[] {
        return this._sliders;
    }

    public addSlider(slider: Slider, side: Side) {
        this._sliders[side] = slider;
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
        const newTile = TileUtils.build_tile(this._rect, this._containerRect);
        this._tile.x = newTile.x;
        this._tile.y = newTile.y;
        this._tile.width = newTile.width;
        this._tile.height = newTile.height;
    }
    
    public updatePosition(x: number, y: number) {
        this._rect.x = Math.round(x);
        this._rect.y = Math.round(y);
        this.set_position(this.innerX, this.innerY);
        const newTile = TileUtils.build_tile(this._rect, this._containerRect);
        this._tile.x = newTile.x;
        this._tile.y = newTile.y;
        this._tile.width = newTile.width;
        this._tile.height = newTile.height;
    }

    public connect(id: string, callback: (...args: any[]) => any): number;
    public connect(signal: "clicked", callback: (_source: this, clicked_button: number) => void): number;
    public connect(signal: string, callback: any): number {
        if (signal === "clicked") return this._btn.connect("clicked", callback);
        return super.connect(signal, callback);
    }

    public destroy(): void {
        this._sliders = [];
        this._btn.destroy();
        super.destroy();
    }
}