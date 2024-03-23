import { registerGObjectClass } from "@/utils/gjs";
import { BlurEffect } from "@gi-types/shell0";
import { TilePreview } from "../tilepreview/tilePreview";

@registerGObjectClass
export class EditableTilePreview extends TilePreview {
    public updateSize(width: number, height: number) {
        this._rect.width = width;
        this._rect.height = height;
        this.set_size(this.innerWidth, this.innerHeight);
    }
    
    public updatePosition(x: number, y: number) {
        this._rect.x = x;
        this._rect.y = y;
        this.set_position(this.innerX, this.innerY);
    }
}