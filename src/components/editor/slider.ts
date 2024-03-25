import { registerGObjectClass } from "@/utils/gjs";
import Clutter, { ActorAlign } from "@gi-types/clutter10";
import St, { Side } from "@gi-types/st1";
import { EditableTilePreview } from "./editableTilePreview";
import { logger } from "@/utils/shell";
import { Rectangle } from "@gi-types/meta10";

const debug = logger("Slider");

@registerGObjectClass
export class Slider extends St.Button {
    private readonly _minTileSize: number = 140;

    private _dragging: boolean;
    private _grab: any;
    private _horizontalDir: boolean;
    private _lastEventCoord: { x: number, y: number } | null;

    private _previousTiles: EditableTilePreview[];
    private _nextTiles: EditableTilePreview[];
    private _minTileCoord: number;
    private _maxTileCoord: number;

    constructor(parent: Clutter.Actor, size: number, x: number, y: number, horizontal: boolean) {
        super({ 
            style_class: "icon-button layout-editor-slider",
            can_focus: true,
            x_expand: false
        });
        parent.add_child(this);
        this._horizontalDir = horizontal;

        this._previousTiles = [];
        this._nextTiles = [];
        this._minTileCoord = Number.MAX_VALUE;
        this._maxTileCoord = Number.MIN_VALUE;

        this.child = new St.Icon({ icon_name: "list-add-symbolic", icon_size: size, x_expand: false });
        this._dragging = false;
        this._lastEventCoord = null;
        this.set_position(Math.round(x - (this.width / 2)), Math.round(y - (this.height / 2)));
    }

    public get horizontal() : boolean {
        return this._horizontalDir;
    }

    public addTile(tile: EditableTilePreview) {
        const isNext = this._horizontalDir ? this.x <= tile.rect.x:this.y <= tile.rect.y;
        if (isNext) this._nextTiles.push(tile);
        else this._previousTiles.push(tile);

        const side = this._horizontalDir ? (isNext ? Side.LEFT:Side.RIGHT):(isNext ? Side.TOP:Side.BOTTOM);
        tile.addSlider(this, side);

        this._minTileCoord = Math.min(this._minTileCoord, this._horizontalDir ? tile.rect.y:tile.rect.x);
        this._maxTileCoord = Math.max(this._maxTileCoord, this._horizontalDir ? tile.rect.y + tile.rect.height:tile.rect.x + tile.rect.width);

        this._updatePosition();
    }

    public removeTile(tileToRemove: EditableTilePreview) {
        const isNext = this._horizontalDir ? this.x <= tileToRemove.rect.x:this.y <= tileToRemove.rect.y;
        const oldArray = isNext ? this._nextTiles:this._previousTiles;
        if (isNext) this._nextTiles = [];
        else this._previousTiles = [];

        this._minTileCoord = Number.MAX_VALUE;
        this._maxTileCoord = Number.MIN_VALUE;

        oldArray
            .filter(tile => tile !== tileToRemove)
            .forEach(tile => this.addTile(tile));
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
        eventX = Math.round(eventX);
        eventY = Math.round(eventY);
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
                if (newSize.width < this._minTileSize || newSize.height < this._minTileSize) return;

                _previousTileNewSize.push(newSize);
            }
            const _nextTileNewSize: { width: number, height: number }[] = [];
            for (const nextTile of this._nextTiles) {
                const newSize = {width: nextTile.rect.width - movement.x, height: nextTile.rect.height - movement.y};
                if (newSize.width < this._minTileSize || newSize.height < this._minTileSize) return;

                _nextTileNewSize.push(newSize);
            }
            // all the computed new sizes of each previous and next tile are valid,
            // we can update the slider position and the tiles size 
            this.set_position(this.x + movement.x, this.y + movement.y);
            const affectedSliders = new Set<Slider>();
            this._nextTiles.forEach((nextTile, ind) => {
                nextTile.updatePosition(nextTile.rect.x + movement.x, nextTile.rect.y + movement.y);
                const newSize = _nextTileNewSize[ind];
                nextTile.updateSize(newSize.width, newSize.height);
                nextTile.sliders.forEach(otherSlider => {
                    if (otherSlider && otherSlider.horizontal !== this._horizontalDir) 
                        affectedSliders.add(otherSlider)
                });
            });
            const prevAffectedSliders = new Set<Slider>();
            this._previousTiles.forEach((prevTile, ind) => {
                const newSize = _previousTileNewSize[ind];
                prevTile.updateSize(newSize.width, newSize.height);
                prevTile.sliders.forEach(otherSlider => {
                    if (otherSlider && otherSlider.horizontal !== this._horizontalDir) {
                        if (affectedSliders.has(otherSlider)) affectedSliders.delete(otherSlider);
                        else prevAffectedSliders.add(otherSlider);
                    }
                });
            });
            affectedSliders.forEach(slider => slider._onTileSizeChanged(this._horizontalDir ? movement.x:movement.y));
            prevAffectedSliders.forEach(slider => slider._onTileSizeChanged(this._horizontalDir ? movement.x:movement.y));
        }
        this._lastEventCoord = { x: eventX, y: eventY };
    }

    private _onTileSizeChanged(movement: number) {
        this._minTileCoord += movement / 2;
        this._maxTileCoord += movement / 2;
        
        this._updatePosition();
    }

    private _updatePosition() {
        const newCoord = (this._minTileCoord + this._maxTileCoord) / 2;
        if (this._horizontalDir) this.set_y(Math.round(newCoord - (this.height / 2)));
        else this.set_x(Math.round(newCoord - (this.width / 2)));
    }

    public destroy(): void {
        this._minTileCoord = Number.MAX_VALUE;
        this._maxTileCoord = Number.MIN_VALUE;
        this._previousTiles = [];
        this._nextTiles = [];
        this._lastEventCoord = null;
        this._endDragging();
        super.destroy();
    }
}