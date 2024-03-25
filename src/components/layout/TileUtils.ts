import { Rectangle } from "@gi-types/meta10";
import Tile from "./Tile";

export default class TileUtils {
    static apply_props(tile: Tile, container: Rectangle): Rectangle {
        return new Rectangle({
            x: (container.width * tile.x) + container.x,
            y: (container.height * tile.y) + container.y,
            width: container.width * tile.width,
            height: container.height * tile.height,
        });
    }

    static build_tile(rect: Rectangle, container: Rectangle): Tile {
        return new Tile({
            x: (rect.x - container.x) / container.width,
            y: (rect.y - container.y) / container.height,
            width: rect.width / container.width,
            height: rect.height / container.height
        });
    }
}