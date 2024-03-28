import { registerGObjectClass } from "@/utils/gjs";
import Clutter, { ModifierType } from "@gi-types/clutter10";
import St, { Side } from "@gi-types/st1";
import Meta, { Rectangle } from "@gi-types/meta10";
import Settings from "@/settings";
import { Main, buildTileMargin, getScalingFactor } from "@/utils/ui";
import { Layout } from "../layout/Layout";
import TileUtils from "../layout/TileUtils";
import { Slider } from "./slider";
import { EditableTilePreview } from "./editableTilePreview";
import { logger } from "@/utils/shell";
import Tile from "../layout/Tile";
import SignalHandling from "@/signalHandling";

const debug = logger("LayoutEditor");

@registerGObjectClass
export class LayoutEditor extends St.Widget {
    private _layout: Layout;
    private _containerRect: Rectangle;
    private _sliders: Slider[];
    private _scaleFactor: number;
    private _innerGaps: Clutter.Margin;
    private _outerGaps: Clutter.Margin;

    constructor(layout: Layout, monitor: Monitor) {
        super({ style_class: "layout-editor" });
        global.window_group.add_child(this);
        this._layout = layout;
        const workArea = Main.layoutManager.getWorkAreaForMonitor(monitor.index);
        this.set_position(workArea.x, workArea.y);
        this.set_size(workArea.width, workArea.height);
        this._scaleFactor = getScalingFactor(monitor.index);
        this._innerGaps = new Clutter.Margin(Settings.get_inner_gaps(this._scaleFactor));
        this._outerGaps = new Clutter.Margin(Settings.get_outer_gaps(this._scaleFactor));
        this._sliders = [];
        this._containerRect = new Meta.Rectangle({x:0, y:0, width: workArea.width, height: workArea.height});
        
        const previews = this._layout.tiles.map(tile => {
            const rect = TileUtils.apply_props(tile, this._containerRect);
            return this._buildEditableTile(tile, rect);
        });

        const groupByX = new Map<number, Slider>();
        const groupByY = new Map<number, Slider>();

        previews.forEach(editableTile => {
            const tile = editableTile.tile;
            const rect = editableTile.rect;

            if (tile.x + tile.width < 1) {
                if (!groupByX.has(tile.x + tile.width)) {
                    const slider = this._buildSlider(true, rect.x + rect.width);
                    groupByX.set(tile.x + tile.width, slider);
                    this._sliders.push(slider);
                }
                groupByX.get(tile.x + tile.width)?.addTile(editableTile);
            }
            if (tile.x > 0) {
                if (!groupByX.has(tile.x)) {
                    const slider = this._buildSlider(true, rect.x);
                    groupByX.set(tile.x, slider);
                    this._sliders.push(slider);
                }
                groupByX.get(tile.x)?.addTile(editableTile);
            }

            if (tile.y + tile.height < 1) {
                if (!groupByY.has(tile.y + tile.height)) {
                    const slider = this._buildSlider(false, rect.y + rect.height);
                    this._sliders.push(slider);
                    groupByY.set(tile.y + tile.height, slider);
                }
                groupByY.get(tile.y + tile.height)?.addTile(editableTile);
            }
            if (tile.y > 0) {
                if (!groupByY.has(tile.y)) {
                    const slider = this._buildSlider(false, rect.y);
                    this._sliders.push(slider);
                    groupByY.set(tile.y, slider);
                }
                groupByY.get(tile.y)?.addTile(editableTile);
            }
        });
    }

    private _buildEditableTile(tile: Tile, rect: Rectangle) : EditableTilePreview {
        const gaps = buildTileMargin(rect, this._innerGaps, this._outerGaps, this._containerRect);
        const editableTile = new EditableTilePreview({ tile, containerRect: this._containerRect, parent: this, rect, gaps });
        editableTile.open();
        editableTile.connect("clicked", (_, clicked_button: number) => {
            // St.ButtonMask.ONE is left click. 3 is right click (but for some reason St.ButtonMask.THREE is equal to 4, so we cannot use it)
            if (clicked_button === St.ButtonMask.ONE) this.splitTile(editableTile);
            else if (clicked_button === 3) this.deleteTile(editableTile);
        });
        if (this._sliders.length > 0) this.set_child_below_sibling(editableTile, this._sliders[0]);
        return editableTile;
    }

    private splitTile(editableTile: EditableTilePreview) {
        const oldTile = editableTile.tile;
        const index = this._layout.tiles.indexOf(oldTile);
        if (index < 0) return;

        const [x, y, modifier] = global.get_pointer();
        // do not split horizontally when CTRL is pressed
        const splitHorizontally = (modifier & ModifierType.CONTROL_MASK) == 0;

        const prevTile = new Tile({
            x: oldTile.x,
            y: oldTile.y,
            width: splitHorizontally ? (oldTile.width / 2):oldTile.width,
            height: splitHorizontally ? oldTile.height:(oldTile.height / 2)
        });
        const nextTile = new Tile({
            x: splitHorizontally ? (oldTile.x + (oldTile.width / 2)):oldTile.x,
            y: splitHorizontally ? oldTile.y:(oldTile.y + (oldTile.height / 2)),
            width: splitHorizontally ?( oldTile.width / 2):oldTile.width,
            height: splitHorizontally ? oldTile.height:( oldTile.height / 2)
        });

        const prevRect = TileUtils.apply_props(prevTile, this._containerRect);
        const nextRect = TileUtils.apply_props(nextTile, this._containerRect);
        if (prevRect.height < EditableTilePreview.MIN_TILE_SIZE ||
            prevRect.width < EditableTilePreview.MIN_TILE_SIZE ||
            nextRect.height < EditableTilePreview.MIN_TILE_SIZE ||
            nextRect.width < EditableTilePreview.MIN_TILE_SIZE) return;
        
        this._layout.tiles[index] = prevTile;
        this._layout.tiles.push(nextTile);

        const prevEditableTile = this._buildEditableTile(prevTile, prevRect);
        const nextEditableTile = this._buildEditableTile(nextTile, nextRect);

        const slider = this._buildSlider(splitHorizontally, splitHorizontally ? nextEditableTile.rect.x:nextEditableTile.rect.y);
        this._sliders.push(slider);
        slider.addTile(prevEditableTile);
        slider.addTile(nextEditableTile);

        if (splitHorizontally) {
            editableTile.sliders[Side.TOP]?.onTileSplit(editableTile, [prevEditableTile, nextEditableTile]);
            editableTile.sliders[Side.BOTTOM]?.onTileSplit(editableTile, [prevEditableTile, nextEditableTile]);
            editableTile.sliders[Side.LEFT]?.onTileSplit(editableTile, [prevEditableTile]);
            editableTile.sliders[Side.RIGHT]?.onTileSplit(editableTile, [nextEditableTile]);
        } else {
            editableTile.sliders[Side.LEFT]?.onTileSplit(editableTile, [prevEditableTile, nextEditableTile]);
            editableTile.sliders[Side.RIGHT]?.onTileSplit(editableTile, [prevEditableTile, nextEditableTile]);
            editableTile.sliders[Side.TOP]?.onTileSplit(editableTile, [prevEditableTile]);
            editableTile.sliders[Side.BOTTOM]?.onTileSplit(editableTile, [nextEditableTile]);
        }

        editableTile.destroy();
    }

    private deleteTile(editableTile: EditableTilePreview) {
        for (const slider of editableTile.sliders) {
            if (slider === null) continue;

            const success = slider.deleteSlider(editableTile);
            if (success) {
                editableTile.sliders.forEach(otherSlider => otherSlider?.onTileDeleted(editableTile));
                this._layout.tiles = this._layout.tiles.filter(tile => tile !== editableTile.tile);
                this._sliders = this._sliders.filter(sl => sl !== slider);
                slider.destroy();
                editableTile.destroy();
                return;
            }
        }
    }

    private _buildSlider(isHorizontal: boolean, coord: number) : Slider {
        return new Slider(
            this,
            coord,
            coord,
            isHorizontal,
            this._scaleFactor
        );
    }

    public destroy() {
        this._sliders.forEach(slider => slider.destroy());
        this._sliders = [];
        super.destroy();
    }
}