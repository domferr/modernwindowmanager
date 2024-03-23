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

@registerGObjectClass
export class LayoutEditor extends St.Widget {
    private readonly _sliderSize: number = 16;

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
        
        const previews: EditableTilePreview[] = [];
        const groupByX = new Map<number, EditableTilePreview[]>();
        const groupByY = new Map<number, EditableTilePreview[]>();
        
        this._layout.tiles.forEach(tile => {
            const rect = TileUtils.apply_props(tile, containerRect);
            const gaps = buildTileMargin(rect, this._innerGaps, this._outerGaps, containerRect);            
            const editableTile = new EditableTilePreview({ parent: this, rect, gaps });
            previews.push(editableTile);
            
            if (tile.x + tile.width < 1) {
                if (!groupByX.has(rect.x + rect.width)) groupByX.set(rect.x + rect.width, []);
                groupByX.get(rect.x + rect.width)?.push(editableTile);
            }
            if (tile.x > 0) {
                if (!groupByX.has(rect.x)) groupByX.set(rect.x, []);
                groupByX.get(rect.x)?.push(editableTile);
            }

            if (tile.y + tile.height < 1) {
                if (!groupByY.has(rect.y + rect.height)) groupByY.set(rect.y + rect.height, []);
                groupByY.get(rect.y + rect.height)?.push(editableTile);
            }
            if (tile.y > 0) {
                if (!groupByY.has(rect.y)) groupByY.set(rect.y, []);
                groupByY.get(rect.y)?.push(editableTile);
            }
        });
        
        groupByX.forEach((tiles, xPos) => {
            const minYPos = tiles.map(tile => tile.rect.y).reduce((prevVal, currVal) => prevVal < currVal ? prevVal : currVal);
            const maxYPos = tiles.map(tile => tile.rect.y + tile.rect.height).reduce((prevVal, currVal) => prevVal < currVal ? currVal : prevVal);
            const slider = new Slider(
                this, 
                this._sliderSize * this._scaleFactor,
                xPos,
                (minYPos + maxYPos) / 2,
                true,
                140,
                140
            );
            tiles.forEach((preview) => slider.addTile(preview));
            this._sliders.push(slider);
        });

        groupByY.forEach((tiles, yPos) => {
            const minXPos = tiles.map(tile => tile.rect.x).reduce((prevVal, currVal) => prevVal < currVal ? prevVal : currVal);
            const maxXPos = tiles.map(tile => tile.rect.x + tile.rect.width).reduce((prevVal, currVal) => prevVal < currVal ? currVal : prevVal);
            const slider = new Slider(
                this, 
                this._sliderSize * this._scaleFactor,
                (minXPos + maxXPos) / 2,
                yPos,
                false,
                140,
                140
            );
            tiles.forEach((preview) => slider.addTile(preview));
            this._sliders.push(slider);
        });

        previews.forEach(preview => preview.open());

        /*this._previews.forEach(prev => {
            const rect = prev.rect;
            if (rect.x + rect.width < this._workArea.width) {
                const slider = new Slider(
                    this, 
                    this._sliderSize * this._scaleFactor,
                    rect.x + rect.width,
                    rect.y + (rect.height / 2),
                    true,
                    140,
                    140
                );
                slider.addPreviousTile(prev);
                this._sliders.push(slider);
            }
        });
        this._sliders[0].addNextTile(this._previews[this._previews.length - 1]);*/
    }
}