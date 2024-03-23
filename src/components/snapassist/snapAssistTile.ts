import { registerGObjectClass } from "@/utils/gjs";
import { TilePreview } from "../tilepreview/tilePreview";
import Tile from "../layout/Tile";
import { Actor, Margin } from "@gi-types/clutter10";
import { Rectangle } from "@gi-types/meta10";

@registerGObjectClass
export class SnapAssistTile extends TilePreview {
    protected _tile: Tile;

    constructor(params: {
        parent?: Actor,
        rect?: Rectangle,
        gaps?: Margin,
        tile: Tile
    }) {
        super({ parent: params.parent, rect: params.rect, gaps: params.gaps})
        this._tile = params.tile;
    }
    
    _init() {
        super._init();
        this.set_style_class_name('snap-assist-tile');
    }

    public get tile() {
        return this._tile;
    }
}