import { registerGObjectClass } from "@/utils/gjs";
import St from "@gi-types/st1";
import { TilePreview } from "../tilepreview/tilePreview";
import { Layout } from "../layout/Layout";
import TileUtils from "../layout/TileUtils";
import Meta from "@gi-types/meta10";
import { Main, buildTileMargin, getScalingFactor } from "@/utils/ui";
import Settings from "@/settings";
import Clutter from "@gi-types/clutter10";
import { Slider } from "./slider";
import { EditableTilePreview } from "./editableTilePreview";

@registerGObjectClass
export class LayoutEditor extends St.Widget {
    private readonly _sliderSize: number = 16;

    private _layout: Layout;
    private _previews: EditableTilePreview[];
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
        this._previews = this._layout.tiles.map(tile => {
            const rect = TileUtils.apply_props(tile, containerRect);
            const gaps = buildTileMargin(rect, this._innerGaps, this._outerGaps, containerRect);            
            return new EditableTilePreview({ parent: this, rect, gaps, tile});
        });
        this._previews.forEach(prev => prev.open());
        this._previews.forEach(prev => {
            const rect = prev.rect;
            if (rect.x + rect.width < this._workArea.width) {
                const slider = new Slider(
                    this, 
                    this._sliderSize * this._scaleFactor,
                    rect.x + rect.width,
                    rect.y + (rect.height / 2),
                    true,
                    32,
                    32
                );
                slider.addPreviousTile(prev);
                this._sliders.push(slider);
            }
        });
        this._sliders[0].addNextTile(this._previews[this._previews.length - 1]);
    }
}