import { registerGObjectClass } from "@/utils/gjs";
import Clutter from "@gi-types/clutter10";
import St from "@gi-types/st1";
import { EditableTilePreview } from "./editableTilePreview";

@registerGObjectClass
export class Slider extends St.Button {
    private _dragging: boolean;
    private _grab: any;
    private _horizontalDir: boolean;
    private _lastEventCoord: { x: number, y: number } | null;

    private _previousTiles: EditableTilePreview[];
    private _nextTiles: EditableTilePreview[];
    private _minTileWidth: number;
    private _minTileHeight: number;

    constructor(parent: Clutter.Actor, size: number, x: number, y: number, horizontal: boolean, minTileWidth: number, minTileHeight: number) {
        super({ 
            style_class: "icon-button layout-editor-slider",
            can_focus: true,
            x_expand: false
        });
        parent.add_child(this);
        this.child = new St.Icon({ icon_name: "list-add-symbolic", icon_size: size, x_expand: false });
        this._dragging = false;
        this._lastEventCoord = null;
        this._horizontalDir = horizontal;
        this.set_position(x - (this.width / 2), y - (this.height / 2));
        this._previousTiles = [];
        this._nextTiles = [];
        this._minTileWidth = minTileWidth;
        this._minTileHeight = minTileHeight;
    }

    public addNextTile(tile: EditableTilePreview) {
        this._nextTiles.push(tile);
    }

    public addPreviousTile(tile: EditableTilePreview) {
        this._previousTiles.push(tile);
    }

    vfunc_button_press_event(event: Clutter.ButtonEvent) {
        return this._startDragging(event);
    }

    vfunc_button_release_event() {
        if (this._dragging)
            return this._endDragging();

        return Clutter.EVENT_PROPAGATE;
    }

    vfunc_motion_event(event: Clutter.MotionEvent) {
        if (this._dragging)
            return this._motionEvent(this, event);

        return Clutter.EVENT_PROPAGATE;
    }

    private _startDragging(event: Clutter.ButtonEvent) {
        if (this._dragging)
            return Clutter.EVENT_PROPAGATE;

        this._dragging = true;

        this._grab = global.stage.grab(this);
        
        this._move(event.x, event.y);
        return Clutter.EVENT_STOP;
    }

    private _endDragging() {
        if (this._dragging) {
            if (this._grab) {
                this._grab.dismiss();
                this._grab = null;
            }

            this._dragging = false;
            this._lastEventCoord = null;
        }
        return Clutter.EVENT_STOP;
    }

    private _motionEvent(actor: Clutter.Actor, event: Clutter.MotionEvent) {
        this._move(event.x, event.y)
        return Clutter.EVENT_STOP;
    }

    private _move(eventX: number, eventY: number) {
        if (this._lastEventCoord !== null) {
            const movement = {
                x: this._horizontalDir ? eventX - this._lastEventCoord.x:0, 
                y: this._horizontalDir ? 0:eventY - this._lastEventCoord.y
            };
            // compute new sizes and validate them. If any size is not permitted, 
            // do not move slider and do not change any size
            const _previousTileNewSize: { width: number, height: number }[] = [];
            for (const prevTile of this._previousTiles) {
                const newSize = {width: prevTile.rect.width + movement.x, height: prevTile.rect.height + movement.y};
                if (newSize.width < this._minTileWidth || newSize.height < this._minTileHeight) return;

                _previousTileNewSize.push(newSize);
            }
            const _nextTileNewSize: { width: number, height: number }[] = [];
            for (const nextTile of this._nextTiles) {
                const newSize = {width: nextTile.rect.width - movement.x, height: nextTile.rect.height - movement.y};
                if (newSize.width < this._minTileWidth || newSize.height < this._minTileHeight) return;

                _nextTileNewSize.push(newSize);
            }
            // all the computed new sizes of each previous and next tile is valid,
            // we can update the slider position and the tiles size 
            this.set_position(this.x + movement.x, this.y + movement.y);
            this._nextTiles.forEach((nextTile, ind) => {
                nextTile.updatePosition(nextTile.rect.x + movement.x, nextTile.rect.y + movement.y);
                const newSize = _nextTileNewSize[ind];
                nextTile.updateSize(newSize.width, newSize.height);
            });
            this._previousTiles.forEach((prevTile, ind) => {
                const newSize = _previousTileNewSize[ind];
                prevTile.updateSize(newSize.width, newSize.height);
            });
        }
        this._lastEventCoord = { x: eventX, y: eventY };
    }

    public destroy(): void {
        this._previousTiles = [];
        this._nextTiles = [];
        super.destroy();
    }
}