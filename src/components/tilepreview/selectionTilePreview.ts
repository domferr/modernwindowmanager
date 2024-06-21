import { registerGObjectClass } from "@/utils/gjs";
import Clutter from 'gi://Clutter';
import St from 'gi://St';
import TilePreview from "./tilePreview";
import { logger } from "@/utils/shell";
import BlurTilePreview from "./blurTilePreview";

const debug = logger("SelectionTilePreview");

@registerGObjectClass
export default class SelectionTilePreview extends TilePreview {
  constructor(params: {
    parent: Clutter.Actor,
  }) {
    super({ parent: params.parent, name: "SelectionTilePreview" });

    this._recolor();
    const styleChangedSignalID = St.ThemeContext.get_for_stage(global.get_stage()).connect("changed", () => {
      this.set_style(null);
      this._recolor();
    });
    this.connect("destroy", () => St.ThemeContext.get_for_stage(global.get_stage()).disconnect(styleChangedSignalID));
    this._rect.width = this.gaps.left + this.gaps.right;
    this._rect.height = this.gaps.top + this.gaps.bottom;
  }

  _init() {
    super._init();
    this.add_style_class_name("selection-tile-preview");
  }

  _recolor() {
    const backgroundColor = this.get_theme_node().get_background_color().copy();
    // since an alpha value lower than 160 is not so much visible, enforce a minimum value of 160
    const newAlpha = Math.max(Math.min(backgroundColor.alpha + 35, 255), 160);
    // The final alpha value is divided by 255 since CSS needs a value from 0 to 1, but ClutterColor expresses alpha from 0 to 255
    this.set_style(`
      background-color: rgba(${backgroundColor.red}, ${backgroundColor.green}, ${backgroundColor.blue}, ${newAlpha / 255}) !important;
    `);
    /*this.set_style(`
      background-color: rgba(255, 255, 255, 0.5) !important;
    `);*/
  }

  close() {
    if (!this._showing) return;

    this._rect.width = this.gaps.left + this.gaps.right;
    this._rect.height = this.gaps.top + this.gaps.bottom;
    super.close();
  }
}