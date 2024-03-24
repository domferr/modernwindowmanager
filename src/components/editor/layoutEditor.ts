import { registerGObjectClass } from "@/utils/gjs";
import Clutter from "@gi-types/clutter10";
import St from "@gi-types/st1";
import Meta from "@gi-types/meta10";
import Settings from "@/settings";
import { Main, buildTileMargin, getScalingFactor } from "@/utils/ui";
import { Layout } from "../layout/Layout";
import TileUtils from "../layout/TileUtils";
import { Slider } from "./slider";
import { EditableTilePreview } from "./editableTilePreview";
import { logger } from "@/utils/shell";

const debug = logger("LayoutEditor");

@registerGObjectClass
export class LayoutEditor extends St.Widget {
    private readonly _sliderSize: number = 12;

    private _layout: Layout;
    private _sliders: Slider[];
    private _workArea: Meta.Rectangle;
    private _scaleFactor: number;
    private _innerGaps: Clutter.Margin;
    private _outerGaps: Clutter.Margin;

    constructor(layout: Layout, monitor: Monitor) {
        super({ style_class: "layout-editor" });
        global.window_group.add_child(this);

        this._layout = layout;
        this._workArea = Main.layoutManager.getWorkAreaForMonitor(monitor.index);
        this.set_position(this._workArea.x, this._workArea.y);
        this.set_size(this._workArea.width, this._workArea.height);
        this._scaleFactor = getScalingFactor(monitor.index);
        this._innerGaps = new Clutter.Margin(Settings.get_inner_gaps(this._scaleFactor));
        this._outerGaps = new Clutter.Margin(Settings.get_outer_gaps(this._scaleFactor));
        this._sliders = [];
        const containerRect = new Meta.Rectangle({x: 0, y:0, width: this._workArea.width, height: this._workArea.height});
        
        const previews = this._layout.tiles.map(tile => {
            const rect = TileUtils.apply_props(tile, containerRect);
            const gaps = buildTileMargin(rect, this._innerGaps, this._outerGaps, containerRect);            
            const editableTile = new EditableTilePreview({ tile, parent: this, rect, gaps });
            editableTile.open();
            return editableTile;
        });

        const groupByX = new Map<number, Slider>();
        const groupByY = new Map<number, Slider>();

        previews.forEach(editableTile => {
            const tile = editableTile.tile;
            const rect = editableTile.rect;

            if (tile.x + tile.width < 1) {
                if (!groupByX.has(tile.x + tile.width)) {
                    const slider = this._buildSlider(true, rect.x + rect.width);
                    this._sliders.push(slider);
                    groupByX.set(tile.x + tile.width, slider);
                }
                groupByX.get(tile.x + tile.width)?.addTile(editableTile);
            }
            if (tile.x > 0) {
                if (!groupByX.has(tile.x)) {
                    const slider = this._buildSlider(true, rect.x);
                    this._sliders.push(slider);
                    groupByX.set(tile.x, slider);
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

        previews.forEach(preview => preview.open());
    }

    private _buildSlider(isHorizontal: boolean, coord: number) : Slider {
        debug(`build slider at ${coord}`);
        return new Slider(
            this, 
            this._sliderSize * this._scaleFactor,
            coord,
            coord,
            isHorizontal
        );
    }
}