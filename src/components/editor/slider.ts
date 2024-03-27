import { registerGObjectClass } from "@/utils/gjs";
import Clutter from "@gi-types/clutter10";
import St, { Side } from "@gi-types/st1";
import { EditableTilePreview } from "./editableTilePreview";
import { getCurrentExtension, logger } from "@/utils/shell";
import Meta, { Rectangle } from "@gi-types/meta10";
import Gio from "@gi-types/gio2";
import Settings from "@/settings";

const debug = logger("Slider");

@registerGObjectClass
export class Slider extends St.Button {
    private readonly _sliderSize: number = 48;

    private _dragging: boolean;
    private _grab: any;
    private _horizontalDir: boolean;
    private _lastEventCoord: { x: number, y: number } | null;

    private _previousTiles: EditableTilePreview[];
    private _nextTiles: EditableTilePreview[];
    private _minTileCoord: number;
    private _maxTileCoord: number;
    private _scalingFactor: number;

    constructor(parent: Clutter.Actor, x: number, y: number, horizontal: boolean, scaleFactor: number) {
        super({ 
            style_class: "layout-editor-slider", //icon-button
            can_focus: true,
            x_expand: false,
            track_hover: true,
        });
        parent.add_child(this);
        this._horizontalDir = horizontal;
        this._scalingFactor = scaleFactor;
        this.set_width(this.desiredWidth);
        this.set_height(this.desiredHeight);

        this._previousTiles = [];
        this._nextTiles = [];
        this._minTileCoord = Number.MAX_VALUE;
        this._maxTileCoord = Number.MIN_VALUE;

        /*const icon_name = this._horizontalDir ? "horizontal_slider_icon":"vertical_slider_icon";
        this.child = new St.Icon({
            gicon: Gio.icon_new_for_string(`${getCurrentExtension().path}/icons/${icon_name}.svg`),
            x_expand: false,
            height: 160,
            icon_size: 160
        });*/
        this._dragging = false;
        this._lastEventCoord = null;
        this.set_position(Math.round(x - (this.width / 2)), Math.round(y - (this.height / 2)));

        this.connect('notify::hover', () => 
            global.display.set_cursor(this.preferredCursor)
        );
    }

    public canDelete(tile: EditableTilePreview) : boolean {
        if (this._nextTiles.length === 1 && this._nextTiles[0] === tile) {
            return this._previousTiles.length === 0;
        }
        if (this._previousTiles.length === 1 && this._previousTiles[0] === tile) {
            return this._nextTiles.length === 0;
        }
        return false;
    }

    private get desiredWidth() : number {
        return (this._horizontalDir ? (Settings.get_inner_gaps(1).top - 4):this._sliderSize) * this._scalingFactor;
        //return this._horizontalDir ? Settings.get_inner_gaps(1).top - 4:(this._maxTileCoord - this._minTileCoord < (EditableTilePreview.MIN_TILE_SIZE*2) ? EditableTilePreview.MIN_TILE_SIZE/3:100);
    }

    private get desiredHeight() : number {
        return (this._horizontalDir ? this._sliderSize:(Settings.get_inner_gaps(1).top - 4)) * this._scalingFactor;
        //return this._horizontalDir ? (this._maxTileCoord - this._minTileCoord < (EditableTilePreview.MIN_TILE_SIZE*2) ? EditableTilePreview.MIN_TILE_SIZE/3:100):Settings.get_inner_gaps(1).top - 4;
    }

    private get preferredCursor() : Meta.Cursor {
        return this.hover ? (this._horizontalDir ? Meta.Cursor.WEST_RESIZE:Meta.Cursor.NORTH_RESIZE):Meta.Cursor.DEFAULT;
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

    public onTileDeleted(tile: EditableTilePreview) {
        const isNext = this._horizontalDir ? this.x <= tile.rect.x:this.y <= tile.rect.y;
        
        if (isNext) this._nextTiles = this._nextTiles.filter(t => t !== tile);
        else this._previousTiles = this._previousTiles.filter(t => t !== tile);
    }

    public onTileSplit(tileToRemove: EditableTilePreview, newTiles: EditableTilePreview[]) {
        if (newTiles.length === 0) return;

        const isNext = this._horizontalDir ? this.x <= tileToRemove.rect.x:this.y <= tileToRemove.rect.y;
        const array = isNext ? this._nextTiles:this._previousTiles;
        const index = array.indexOf(tileToRemove);
        if (index < 0) return;

        const side = this._horizontalDir ? (isNext ? Side.LEFT:Side.RIGHT):(isNext ? Side.TOP:Side.BOTTOM);
        array[index] = newTiles[0];
        newTiles[0].addSlider(this, side);
        for (let i = 1; i < newTiles.length; i++) {
            const tile = newTiles[i];
            array.push(tile);
            tile.addSlider(this, side);
        }
    }

    public deleteSlider(tile: EditableTilePreview): boolean {
        const isNext = this._horizontalDir ? this.x <= tile.rect.x:this.y <= tile.rect.y;
        const array = isNext ? this._nextTiles:this._previousTiles;

        if (array.length > 1 || array[0] !== tile) return false;
        
        array.pop();

        const extensionRect = new Rectangle({
            width: this._horizontalDir ? tile.rect.width:0,
            height: this._horizontalDir ? 0:tile.rect.height
        });

        const otherSliderSide = this._horizontalDir ? (isNext ? Side.RIGHT:Side.LEFT):(isNext ? Side.BOTTOM:Side.TOP);
        (isNext ? this._previousTiles:this._nextTiles).forEach((tileToExtend) => {
            tileToExtend.updateSize(
                tileToExtend.rect.width + extensionRect.width,
                tileToExtend.rect.height + extensionRect.height
            );
            if (!isNext) {
                tileToExtend.updatePosition(
                    tile.rect.x,
                    tile.rect.y
                );
            }
            tile.sliders[otherSliderSide]?.addTile(tileToExtend);
        });

        return true;
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
        global.display.set_cursor(this.preferredCursor);

        this._grab = global.stage.grab(this);
        
        this._move(event.x, event.y);
        return Clutter.EVENT_STOP;
    }

    private _endDragging() {
        global.display.set_cursor(this.preferredCursor);
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
                if (newSize.width < EditableTilePreview.MIN_TILE_SIZE || newSize.height < EditableTilePreview.MIN_TILE_SIZE) return;

                _previousTileNewSize.push(newSize);
            }
            const _nextTileNewSize: { width: number, height: number }[] = [];
            for (const nextTile of this._nextTiles) {
                const newSize = {width: nextTile.rect.width - movement.x, height: nextTile.rect.height - movement.y};
                if (newSize.width < EditableTilePreview.MIN_TILE_SIZE || newSize.height < EditableTilePreview.MIN_TILE_SIZE) return;

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
        this.set_width(this.desiredWidth);
        this.set_height(this.desiredHeight);
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