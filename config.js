/* =====================================================================
   SHELF SETTINGS — config.js
   Tweak how the wall is laid out and how it feels to move around.
   ===================================================================== */

window.ShelfConfig = {
    // How many CDs stand side by side in one cubby.
    CdsPerShelf: 3,

    // How many cubbies wide your collection is before the wall repeats.
    // "auto" picks a landscape-ish block. The wall is endless: the whole
    // collection repeats seamlessly in every direction.
    CubbiesAcross: "auto",

    // Optional: path to a real wood photo (e.g. "textures/walnut.jpg") to use
    // for the shelves instead of the generated grain. A wide shot of
    // horizontal grain, at least 1000px across, works best.
    WoodTextureImage: "",

    // Order of CDs on the wall: "Random" (new order every visit), "Manual"
    // (order in albums.js), "AlbumNumber", "ArtistName", "AlbumName",
    // "AlbumYear" or "AlbumYearNewestFirst".
    SortAlbumsBy: "Random",

    // Footer (always at the bottom of the screen)
    FooterHeading: "The Listening Wall",
    FooterText: "A personal CD collection, one jewel case at a time. Click a case for the details and a link to Spotify, then click the cover to turn it over.",

    // Movement feel.
    PanSmoothing: 0.2,        // 0–1, higher = snappier follow
    PanFriction: 0.93,        // 0–1, higher = longer glide after a flick
    KeyboardPanSpeed: 16,     // pixels per frame while an arrow / WASD key is held
    WheelPanMultiplier: 1,

    // Zoom limits (pinch on touch / trackpad, or Ctrl / Cmd + scroll).
    MinimumZoom: 0.6,
    MaximumZoom: 2.2,

    // Size of a CD cover in pixels, chosen from the screen size within these limits.
    MinimumCdSizePx: 92,
    MaximumCdSizePx: 196,
};
