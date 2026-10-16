/* =====================================================================
   THE LISTENING WALL — app.js
   1. Settings   2. Utilities   3. Album data   4. Textures + layout
   5. Album elements   6. Camera + zoom   7. Input   8. Album taps
   9. Album details popup   10. Collection footer   11. Start-up
   Add CDs in albums.js; change behaviour in config.js.
   ===================================================================== */

(function StartListeningWall() {
    "use strict";

    /* ------------------------------------------------------------------ */
    /* 1. Settings (defaults; config.js overrides them)                   */
    /* ------------------------------------------------------------------ */

    const ShelfConfig = Object.assign({
        CdsPerShelf: 3,
        CubbiesAcross: "auto",
        WoodTextureImage: "",
        SortAlbumsBy: "Random",
        PanSmoothing: 0.2,
        PanFriction: 0.93,
        KeyboardPanSpeed: 16,
        MinimumZoom: 0.6,
        MaximumZoom: 2.2,
        FooterHeading: "The Listening Wall",
        FooterText: "",
        WheelPanMultiplier: 1,
        MinimumCdSizePx: 92,
        MaximumCdSizePx: 196,
    }, window.ShelfConfig || {});

    const ListeningRoomElement = document.getElementById("ListeningRoom");
    const ShelfWallElement = document.getElementById("ShelfWall");
    const RootStyle = document.documentElement.style;
    const PrefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* ------------------------------------------------------------------ */
    /* 2. Utilities                                                       */
    /* ------------------------------------------------------------------ */

    function ClampNumber(Value, Minimum, Maximum) {
        return Math.min(Maximum, Math.max(Minimum, Value));
    }

    function HashTextToNumber(Text) {
        let Hash = 2166136261;
        for (let CharacterIndex = 0; CharacterIndex < Text.length; CharacterIndex++) {
            Hash ^= Text.charCodeAt(CharacterIndex);
            Hash = Math.imul(Hash, 16777619);
        }
        return Hash >>> 0;
    }

    function CreateSeededRandom(Seed) {
        let State = (typeof Seed === "string" ? HashTextToNumber(Seed) : Seed) || 1;
        return function NextRandom() {
            State = (State + 0x6D2B79F5) | 0;
            let Mixed = Math.imul(State ^ (State >>> 15), 1 | State);
            Mixed = (Mixed + Math.imul(Mixed ^ (Mixed >>> 7), 61 | Mixed)) ^ Mixed;
            return ((Mixed ^ (Mixed >>> 14)) >>> 0) / 4294967296;
        };
    }

    function CreateElement(TagName, ClassName, Attributes) {
        const NewElement = document.createElement(TagName);
        if (ClassName) NewElement.className = ClassName;
        if (Attributes) {
            for (const AttributeName in Attributes) NewElement.setAttribute(AttributeName, Attributes[AttributeName]);
        }
        return NewElement;
    }

    /* ------------------------------------------------------------------ */
    /* 3. Album data                                                      */
    /* ------------------------------------------------------------------ */

    // Every album gets a number; its photos are found from it (covers/01-front.jpg, covers/01-back.jpg)
    function NormaliseAlbum(RawAlbum, AlbumIndex) {
        const AlbumNumber = Number(RawAlbum.AlbumNumber) || AlbumIndex + 1;
        const AlbumNumberText = String(AlbumNumber).padStart(2, "0");
        const TrackList = Array.isArray(RawAlbum.TrackList) ? RawAlbum.TrackList : [];
        return {
            AlbumId: RawAlbum.AlbumId || `album-${AlbumNumberText}`,
            AlbumNumber,
            AlbumNumberText,
            AlbumName: RawAlbum.AlbumName || "Untitled",
            ArtistName: RawAlbum.ArtistName || "Unknown Artist",
            AlbumDate: RawAlbum.AlbumDate || "",
            AlbumYear: RawAlbum.AlbumYear || RawAlbum.ReleaseYear || "",
            NumberOfTracks: RawAlbum.NumberOfTracks || "",
            AlbumLength: RawAlbum.AlbumLength || "",
            FrontCoverImage: RawAlbum.FrontCoverImage || RawAlbum.CoverImage || `covers/${AlbumNumberText}-front.jpg`,
            BackCoverImage: RawAlbum.BackCoverImage || `covers/${AlbumNumberText}-back.jpg`,
            SpotifyAlbumUrl: RawAlbum.SpotifyAlbumUrl || "",
            SpotifyArtistUrl: RawAlbum.SpotifyArtistUrl || "",
            TrackList: TrackList.map((Track) => (typeof Track === "string"
                ? { TrackName: Track, TrackLength: "" }
                : { TrackName: Track.TrackName || Track.TrackTitle || "", TrackLength: Track.TrackLength || "" })),
        };
    }

    function GetAlbumYearNumber(Album) {
        return parseInt(Album.AlbumYear, 10) || 0;
    }

    function SortAlbums(AlbumList, SortKey) {
        const SortedAlbums = AlbumList.slice();
        const CompareText = (FirstText, SecondText) => String(FirstText).localeCompare(String(SecondText), undefined, { sensitivity: "base" });
        const StripLeadingThe = (Text) => String(Text).replace(/^the\s+/i, "");
        switch (SortKey) {
            case "ArtistName":
                SortedAlbums.sort((A, B) => CompareText(StripLeadingThe(A.ArtistName), StripLeadingThe(B.ArtistName)) || (GetAlbumYearNumber(A) - GetAlbumYearNumber(B)));
                break;
            case "AlbumName":
                SortedAlbums.sort((A, B) => CompareText(StripLeadingThe(A.AlbumName), StripLeadingThe(B.AlbumName)));
                break;
            case "AlbumYear":
                SortedAlbums.sort((A, B) => (GetAlbumYearNumber(A) - GetAlbumYearNumber(B)) || CompareText(A.ArtistName, B.ArtistName));
                break;
            case "AlbumYearNewestFirst":
                SortedAlbums.sort((A, B) => (GetAlbumYearNumber(B) - GetAlbumYearNumber(A)) || CompareText(A.ArtistName, B.ArtistName));
                break;
            case "AlbumNumber":
                SortedAlbums.sort((A, B) => A.AlbumNumber - B.AlbumNumber);
                break;
            case "Random":
                // Fisher–Yates shuffle: a fresh order every time the page opens
                for (let AlbumIndex = SortedAlbums.length - 1; AlbumIndex > 0; AlbumIndex--) {
                    const SwapIndex = Math.floor(Math.random() * (AlbumIndex + 1));
                    [SortedAlbums[AlbumIndex], SortedAlbums[SwapIndex]] = [SortedAlbums[SwapIndex], SortedAlbums[AlbumIndex]];
                }
                break;
            default:
                break;
        }
        return SortedAlbums;
    }

    function GetSpotifyAlbumUrl(Album) {
        if (Album.SpotifyAlbumUrl) return Album.SpotifyAlbumUrl;
        return `https://open.spotify.com/search/${encodeURIComponent(`${Album.AlbumName} ${Album.ArtistName}`)}/albums`;
    }

    function GetSpotifyArtistUrl(Album) {
        if (Album.SpotifyArtistUrl) return Album.SpotifyArtistUrl;
        return `https://open.spotify.com/search/${encodeURIComponent(Album.ArtistName)}/artists`;
    }

    function ConvertTrackLengthToSeconds(TrackLength) {
        if (!TrackLength) return 0;
        return String(TrackLength).split(":").reduce((TotalSeconds, Part) => TotalSeconds * 60 + (parseInt(Part, 10) || 0), 0);
    }

    // "12 tracks": NumberOfTracks if filled in, otherwise the TrackList is counted
    function GetTrackCountText(Album) {
        const TrackCount = Album.NumberOfTracks || Album.TrackList.length;
        if (!TrackCount) return "";
        if (Number.isNaN(Number(TrackCount))) return String(TrackCount); // template placeholder text
        return `${TrackCount} ${String(TrackCount) === "1" ? "track" : "tracks"}`;
    }

    // "47:32": AlbumLength if filled in, otherwise added up from the track lengths
    function GetAlbumLengthText(Album) {
        if (Album.AlbumLength) return String(Album.AlbumLength);
        const TotalSeconds = Album.TrackList.reduce((Sum, Track) => Sum + ConvertTrackLengthToSeconds(Track.TrackLength), 0);
        return TotalSeconds ? `${Math.round(TotalSeconds / 60)} min` : "";
    }

    // --- Photo slots: find an uploaded photo, whatever its file type ---

    const PHOTO_FILE_TYPES = [".jpg", ".jpeg", ".png", ".webp", ".JPG", ".JPEG", ".PNG", ".WEBP"];
    const ResolvedPhotoCache = new Map(); // photo path -> Promise of the working URL (or null)

    function TryLoadPhoto(PhotoUrl) {
        return new Promise((Resolve) => {
            const ProbeImage = new Image();
            ProbeImage.onload = () => Resolve(true);
            ProbeImage.onerror = () => Resolve(false);
            ProbeImage.src = PhotoUrl;
        });
    }

    // Tries the path as written, then the same name with other common photo file types
    function ResolvePhoto(PhotoPath) {
        if (!PhotoPath) return Promise.resolve(null);
        if (!ResolvedPhotoCache.has(PhotoPath)) {
            const PathWithoutType = PhotoPath.replace(/\.[a-z0-9]+$/i, "");
            const Candidates = [PhotoPath, ...PHOTO_FILE_TYPES.map((FileType) => PathWithoutType + FileType).filter((Candidate) => Candidate !== PhotoPath)];
            ResolvedPhotoCache.set(PhotoPath, (async () => {
                for (const Candidate of Candidates) {
                    if (await TryLoadPhoto(Candidate)) return Candidate;
                }
                return null;
            })());
        }
        return ResolvedPhotoCache.get(PhotoPath);
    }

    // Show the photo in an <img>, or mark the holder as an empty slot waiting for a photo
    function FillPhotoSlot(ImageElement, HolderElement, PhotoPath) {
        HolderElement.classList.remove("is-empty-slot");
        ResolvePhoto(PhotoPath).then((PhotoUrl) => {
            if (PhotoUrl) ImageElement.src = PhotoUrl;
            else HolderElement.classList.add("is-empty-slot");
        });
    }

    function CreateEmptySlotElement(Album) {
        const EmptySlotElement = CreateElement("span", "photo-slot", { "aria-hidden": "true" });
        EmptySlotElement.innerHTML = '<svg viewBox="0 0 24 24"><path d="M4 8.5h3l1.6-2.5h6.8L17 8.5h3v10H4z"/><circle cx="12" cy="13.2" r="3.4"/></svg>';
        const SlotNumberElement = CreateElement("span", "photo-slot__number");
        SlotNumberElement.textContent = Album.AlbumNumberText;
        EmptySlotElement.appendChild(SlotNumberElement);
        return EmptySlotElement;
    }

    const AlbumCollection = SortAlbums((window.CdCollection || []).map(NormaliseAlbum), ShelfConfig.SortAlbumsBy);
    const AlbumById = new Map(AlbumCollection.map((Album) => [Album.AlbumId, Album]));

    /* ------------------------------------------------------------------ */
    /* 4a. Textures (wood grain, generated once at start)                 */
    /* ------------------------------------------------------------------ */

    function CreatePeriodicNoise(Seed) {
        const LatticeSize = 256;
        const NextRandom = CreateSeededRandom(Seed);
        const Lattice = new Float32Array(LatticeSize * LatticeSize);
        for (let LatticeIndex = 0; LatticeIndex < Lattice.length; LatticeIndex++) Lattice[LatticeIndex] = NextRandom();
        const Smooth = (Value) => Value * Value * (3 - 2 * Value);
        return function SampleNoise(X, Y, PeriodX, PeriodY) {
            const CellX = Math.floor(X), CellY = Math.floor(Y);
            const FractionX = Smooth(X - CellX), FractionY = Smooth(Y - CellY);
            const X0 = ((CellX % PeriodX) + PeriodX) % PeriodX, X1 = (X0 + 1) % PeriodX;
            const Y0 = ((CellY % PeriodY) + PeriodY) % PeriodY, Y1 = (Y0 + 1) % PeriodY;
            const TopLeft = Lattice[Y0 * LatticeSize + X0], TopRight = Lattice[Y0 * LatticeSize + X1];
            const BottomLeft = Lattice[Y1 * LatticeSize + X0], BottomRight = Lattice[Y1 * LatticeSize + X1];
            const Top = TopLeft + (TopRight - TopLeft) * FractionX;
            const Bottom = BottomLeft + (BottomRight - BottomLeft) * FractionX;
            return Top + (Bottom - Top) * FractionY;
        };
    }

    function CreateWoodGrainCanvas({ TextureWidth = 1024, TextureHeight = 512, LightColor = [188, 116, 66], DarkColor = [86, 44, 22], Seed = "teak" } = {}) {
        const WoodCanvas = document.createElement("canvas");
        WoodCanvas.width = TextureWidth;
        WoodCanvas.height = TextureHeight;
        const WoodContext = WoodCanvas.getContext("2d");
        const WoodPixels = WoodContext.createImageData(TextureWidth, TextureHeight);
        const SampleNoise = CreatePeriodicNoise(Seed);
        const RingCount = 22;

        for (let PixelY = 0; PixelY < TextureHeight; PixelY++) {
            const V = PixelY / TextureHeight;
            for (let PixelX = 0; PixelX < TextureWidth; PixelX++) {
                const U = PixelX / TextureWidth;
                // Large slow warp gives the cathedral-shaped grain of flat-sawn boards
                const Warp =
                    SampleNoise(U * 2, V * 3, 2, 3) * 0.55 +
                    SampleNoise(U * 5, V * 6, 5, 6) * 0.3 +
                    SampleNoise(U * 11, V * 12, 11, 12) * 0.15;
                const GrainPosition = V * RingCount + Warp * 3.2 + Math.sin(U * Math.PI * 4 + Warp * 3) * 0.18;
                const EarlyLateWood = Math.pow(0.5 + 0.5 * Math.sin(GrainPosition * Math.PI * 2), 2.2);
                const LateWoodLine = Math.pow(1 - Math.abs(Math.sin(GrainPosition * Math.PI)), 14);
                const FineStreaks = SampleNoise(U * 4, V * 260, 4, 260);
                const Pores = SampleNoise(U * 140, V * 90, 140, 90);
                const BroadColour = SampleNoise(U * 2, V * 1, 2, 1);
                let Lightness =
                    0.62 - 0.2 * EarlyLateWood - 0.24 * LateWoodLine +
                    (FineStreaks - 0.5) * 0.22 + (BroadColour - 0.5) * 0.3 -
                    (Pores > 0.8 ? (Pores - 0.8) * 0.9 : 0);
                Lightness = ClampNumber(Lightness, 0, 1);
                const PixelOffset = (PixelY * TextureWidth + PixelX) * 4;
                WoodPixels.data[PixelOffset] = DarkColor[0] + (LightColor[0] - DarkColor[0]) * Lightness;
                WoodPixels.data[PixelOffset + 1] = DarkColor[1] + (LightColor[1] - DarkColor[1]) * Lightness;
                WoodPixels.data[PixelOffset + 2] = DarkColor[2] + (LightColor[2] - DarkColor[2]) * Lightness;
                WoodPixels.data[PixelOffset + 3] = 255;
            }
        }
        WoodContext.putImageData(WoodPixels, 0, 0);
        return WoodCanvas;
    }

    function RotateCanvasQuarterTurn(SourceCanvas) {
        const RotatedCanvas = document.createElement("canvas");
        RotatedCanvas.width = SourceCanvas.height;
        RotatedCanvas.height = SourceCanvas.width;
        const RotatedContext = RotatedCanvas.getContext("2d");
        RotatedContext.translate(RotatedCanvas.width, 0);
        RotatedContext.rotate(Math.PI / 2);
        RotatedContext.drawImage(SourceCanvas, 0, 0);
        return RotatedCanvas;
    }

    function ApplyGeneratedTextures() {
        try {
            const HorizontalWoodCanvas = CreateWoodGrainCanvas({ Seed: "listening-wall-teak" });
            const VerticalWoodCanvas = RotateCanvasQuarterTurn(HorizontalWoodCanvas);
            RootStyle.setProperty("--wood-grain-horizontal", `url("${HorizontalWoodCanvas.toDataURL("image/jpeg", 0.9)}")`);
            RootStyle.setProperty("--wood-grain-vertical", `url("${VerticalWoodCanvas.toDataURL("image/jpeg", 0.9)}")`);
        } catch (TextureError) {
            console.warn("[ListeningWall] Could not generate textures, using flat wood colour.", TextureError);
        }
    }

    // Optional: a real wood photo (ShelfConfig.WoodTextureImage) replaces the generated grain
    function ApplyWoodPhotoTexture() {
        if (!ShelfConfig.WoodTextureImage) return;
        const WoodPhoto = new Image();
        WoodPhoto.onload = () => {
            try {
                const HorizontalCanvas = document.createElement("canvas");
                HorizontalCanvas.width = WoodPhoto.naturalWidth;
                HorizontalCanvas.height = WoodPhoto.naturalHeight;
                HorizontalCanvas.getContext("2d").drawImage(WoodPhoto, 0, 0);
                RootStyle.setProperty("--wood-grain-horizontal", `url("${ShelfConfig.WoodTextureImage}")`);
                RootStyle.setProperty("--wood-grain-vertical", `url("${RotateCanvasQuarterTurn(HorizontalCanvas).toDataURL("image/jpeg", 0.9)}")`);
            } catch (PhotoError) {
                RootStyle.setProperty("--wood-grain-horizontal", `url("${ShelfConfig.WoodTextureImage}")`);
                RootStyle.setProperty("--wood-grain-vertical", `url("${ShelfConfig.WoodTextureImage}")`);
            }
        };
        WoodPhoto.onerror = () => console.warn(`[ListeningWall] Could not load WoodTextureImage "${ShelfConfig.WoodTextureImage}".`);
        WoodPhoto.src = ShelfConfig.WoodTextureImage;
    }

    /* ------------------------------------------------------------------ */
    /* 4b. Layout: the collection forms one tile of cubbies; tiles repeat */
    /* ------------------------------------------------------------------ */
    // in every direction and off-screen copies are recycled, so the wall never ends.

    // Sizes in CD-cover units; keep in step with the geometry tokens in styles.css
    const CUBBY_FRAME_IN_CD_UNITS = 0.12;
    const SLOT_GAP_IN_CD_UNITS = 0.14;
    const CASE_WIDTH_IN_CD_UNITS = 1.09;
    const CUBBY_HEIGHT_IN_CD_UNITS = 0.2 + 1.02 + 0.1;

    let CurrentLayoutMetrics = null;

    function ComputeLayoutMetrics() {
        const ViewportWidth = window.innerWidth;
        const ViewportHeight = window.innerHeight;
        const CdSizePx = Math.round(ClampNumber(
            Math.min(ViewportHeight * 0.17, ViewportWidth * 0.26),
            ShelfConfig.MinimumCdSizePx,
            ShelfConfig.MaximumCdSizePx
        ));
        const CdsPerShelf = Math.max(1, Math.round(ShelfConfig.CdsPerShelf));
        const CubbyCount = Math.max(1, Math.ceil(AlbumCollection.length / CdsPerShelf));

        let CubbiesAcross = Number(ShelfConfig.CubbiesAcross);
        if (!CubbiesAcross || ShelfConfig.CubbiesAcross === "auto") {
            // Shape the tile roughly like a landscape screen so repeats are far apart
            const CubbyWidthUnits = CUBBY_FRAME_IN_CD_UNITS + SLOT_GAP_IN_CD_UNITS + CdsPerShelf * (CASE_WIDTH_IN_CD_UNITS + SLOT_GAP_IN_CD_UNITS);
            const TargetTileAspect = Math.max(ViewportWidth / ViewportHeight, 1.3) * 1.15;
            CubbiesAcross = Math.round(Math.sqrt((CubbyCount * TargetTileAspect * CUBBY_HEIGHT_IN_CD_UNITS) / CubbyWidthUnits));
        }
        CubbiesAcross = ClampNumber(Math.round(CubbiesAcross), 1, CubbyCount);
        const CubbiesDown = Math.ceil(CubbyCount / CubbiesAcross);

        return {
            ViewportWidth,
            ViewportHeight,
            CdSizePx,
            CdsPerShelf,
            CubbiesAcross,
            CubbiesDown,
        };
    }

    function ApplyLayoutSizes(LayoutMetrics) {
        RootStyle.setProperty("--cd", `${LayoutMetrics.CdSizePx}px`);
        RootStyle.setProperty("--tile-columns", String(LayoutMetrics.CubbiesAcross));
    }

    function CreateShelfTileElement(LayoutMetrics) {
        const ShelfTileElement = CreateElement("div", "shelf-tile");
        for (let RowIndex = 0; RowIndex < LayoutMetrics.CubbiesDown; RowIndex++) {
            for (let ColumnIndex = 0; ColumnIndex < LayoutMetrics.CubbiesAcross; ColumnIndex++) {
                const CubbyIndex = RowIndex * LayoutMetrics.CubbiesAcross + ColumnIndex;
                ShelfTileElement.appendChild(CreateCubbyElement(CubbyIndex, LayoutMetrics));
            }
        }
        return ShelfTileElement;
    }

    function CreateCubbyElement(CubbyIndex, LayoutMetrics) {
        const NextRandom = CreateSeededRandom(`cubby-${CubbyIndex}`);
        const CubbyElement = CreateElement("div", "cubby");
        // Each board is cut from a different part of the plank, and some cubbies sit a touch darker
        CubbyElement.style.setProperty("--grain-x", `${Math.round(NextRandom() * -900)}px`);
        CubbyElement.style.setProperty("--grain-y", `${Math.round(NextRandom() * -400)}px`);
        CubbyElement.style.setProperty("--cubby-shade", (NextRandom() * 0.16).toFixed(3));
        CubbyElement.appendChild(CreateElement("span", "cubby-light", { "aria-hidden": "true" }));

        for (let SlotIndex = 0; SlotIndex < LayoutMetrics.CdsPerShelf; SlotIndex++) {
            // Every slot holds a CD face-up; leftover slots at the end carry on from the start of the collection
            const SlotNumber = CubbyIndex * LayoutMetrics.CdsPerShelf + SlotIndex;
            const Album = AlbumCollection[SlotNumber % AlbumCollection.length];
            if (Album) CubbyElement.appendChild(CreateAlbumElement(Album));
        }
        CubbyElement.appendChild(CreateElement("span", "cubby-dim", { "aria-hidden": "true" }));
        return CubbyElement;
    }

    const TilePool = {
        Tiles: [],            // { TileElement, TileIndexX, TileIndexY }
        TileWidth: 1,
        TileHeight: 1,
        CopiesAcross: 1,
        CopiesDown: 1,
        FirstVisibleIndexX: null,
        FirstVisibleIndexY: null,
    };

    function BuildTilePool(LayoutMetrics) {
        const FirstTileElement = CreateShelfTileElement(LayoutMetrics);
        ShelfWallElement.replaceChildren(FirstTileElement);
        TilePool.TileWidth = Math.max(1, FirstTileElement.offsetWidth);
        TilePool.TileHeight = Math.max(1, FirstTileElement.offsetHeight);
        // Enough copies to cover the screen even when zoomed all the way out
        TilePool.CopiesAcross = Math.ceil(LayoutMetrics.ViewportWidth / (TilePool.TileWidth * ShelfConfig.MinimumZoom)) + 1;
        TilePool.CopiesDown = Math.ceil(LayoutMetrics.ViewportHeight / (TilePool.TileHeight * ShelfConfig.MinimumZoom)) + 1;
        TilePool.Tiles = [{ TileElement: FirstTileElement, TileIndexX: null, TileIndexY: null }];

        const TileCount = TilePool.CopiesAcross * TilePool.CopiesDown;
        for (let TileNumber = 1; TileNumber < TileCount; TileNumber++) {
            const TileCopyElement = CreateShelfTileElement(LayoutMetrics);
            ShelfWallElement.appendChild(TileCopyElement);
            TilePool.Tiles.push({ TileElement: TileCopyElement, TileIndexX: null, TileIndexY: null });
        }
        TilePool.FirstVisibleIndexX = TilePool.FirstVisibleIndexY = null;
    }

    function PlaceTile(Tile, TileIndexX, TileIndexY) {
        Tile.TileIndexX = TileIndexX;
        Tile.TileIndexY = TileIndexY;
        Tile.TileElement.style.transform = `translate3d(${TileIndexX * TilePool.TileWidth}px, ${TileIndexY * TilePool.TileHeight}px, 0)`;
    }

    // Make sure every tile position the screen can see has a tile in it
    function UpdateVisibleTiles() {
        const FirstVisibleIndexX = Math.floor(-CameraState.CurrentX / CameraState.CurrentScale / TilePool.TileWidth);
        const FirstVisibleIndexY = Math.floor(-CameraState.CurrentY / CameraState.CurrentScale / TilePool.TileHeight);
        if (FirstVisibleIndexX === TilePool.FirstVisibleIndexX && FirstVisibleIndexY === TilePool.FirstVisibleIndexY) return;
        TilePool.FirstVisibleIndexX = FirstVisibleIndexX;
        TilePool.FirstVisibleIndexY = FirstVisibleIndexY;

        const IsInView = (TileIndexX, TileIndexY) =>
            TileIndexX !== null &&
            TileIndexX >= FirstVisibleIndexX && TileIndexX < FirstVisibleIndexX + TilePool.CopiesAcross &&
            TileIndexY >= FirstVisibleIndexY && TileIndexY < FirstVisibleIndexY + TilePool.CopiesDown;

        const OccupiedPositions = new Set();
        const FreeTiles = [];
        TilePool.Tiles.forEach((Tile) => {
            if (IsInView(Tile.TileIndexX, Tile.TileIndexY)) OccupiedPositions.add(`${Tile.TileIndexX},${Tile.TileIndexY}`);
            else FreeTiles.push(Tile);
        });

        for (let OffsetY = 0; OffsetY < TilePool.CopiesDown; OffsetY++) {
            for (let OffsetX = 0; OffsetX < TilePool.CopiesAcross; OffsetX++) {
                const TileIndexX = FirstVisibleIndexX + OffsetX;
                const TileIndexY = FirstVisibleIndexY + OffsetY;
                if (OccupiedPositions.has(`${TileIndexX},${TileIndexY}`)) continue;
                const FreeTile = FreeTiles.pop();
                if (FreeTile) PlaceTile(FreeTile, TileIndexX, TileIndexY);
            }
        }
    }

    /* ------------------------------------------------------------------ */
    /* 5. Album elements (wall CD, popup tray card)                       */
    /* ------------------------------------------------------------------ */

    function CreateAlbumElement(Album) {
        const NextRandom = CreateSeededRandom(Album.AlbumId);
        const AlbumElement = CreateElement("div", "cd", {
            tabindex: "0",
            role: "button",
            "aria-label": `${Album.AlbumName} by ${Album.ArtistName}`,
            "data-album-id": Album.AlbumId,
        });
        // Small, stable imperfections so the shelf looks hand-placed
        AlbumElement.style.setProperty("--lean", `${(3 + NextRandom() * 4).toFixed(2)}deg`);
        AlbumElement.style.setProperty("--tilt", `${((NextRandom() - 0.5) * 1.4).toFixed(2)}deg`);

        AlbumElement.appendChild(CreateElement("span", "cd-contact-shadow", { "aria-hidden": "true" }));
        AlbumElement.appendChild(CreateAlbumFrontElement(Album));
        return AlbumElement;
    }

    function CreateAlbumFrontElement(Album) {
        const AlbumFrontElement = CreateElement("div", "cd-face cd-front");
        const CoverImageElement = CreateElement("img", "cd-cover", {
            alt: "",
            draggable: "false",
            decoding: "async",
            loading: "lazy",
        });
        FillPhotoSlot(CoverImageElement, AlbumFrontElement, Album.FrontCoverImage);
        AlbumFrontElement.append(
            CoverImageElement,
            CreateEmptySlotElement(Album),
            CreateElement("span", "cd-hinge", { "aria-hidden": "true" }),
            CreateElement("span", "cd-gloss", { "aria-hidden": "true" }),
            CreateElement("span", "cd-uplight", { "aria-hidden": "true" })
        );
        return AlbumFrontElement;
    }

    // Back of the case: a tracklist tray card made from the album details
    function CreateAlbumBackElement(Album) {
        const AlbumBackElement = CreateElement("div", "cd-face cd-back");
        const SpineText = `${Album.ArtistName}  ·  ${Album.AlbumName}`;
        const LeftSpineElement = CreateElement("div", "cd-back__spine");
        LeftSpineElement.textContent = SpineText;
        const RightSpineElement = CreateElement("div", "cd-back__spine");
        RightSpineElement.textContent = SpineText;

        const BackBodyElement = CreateElement("div", "cd-back__body");
        const BackHeadingElement = CreateElement("p", "cd-back__heading");
        BackHeadingElement.textContent = Album.AlbumName;

        const TrackListElement = CreateElement("ol", "cd-back__tracks");
        const TrackCount = Album.TrackList.length;
        if (TrackCount > 14) {
            TrackListElement.classList.add("is-two-column");
            TrackListElement.style.gridTemplateRows = `repeat(${Math.ceil(TrackCount / 2)}, auto)`;
        } else if (TrackCount > 10) {
            TrackListElement.classList.add("is-compact");
        }

        Album.TrackList.forEach((Track, TrackIndex) => {
            const TrackElement = CreateElement("li", "cd-back__track");
            const TrackNumberElement = CreateElement("span", "cd-back__track-number");
            TrackNumberElement.textContent = String(TrackIndex + 1).padStart(2, "0");
            const TrackTitleElement = CreateElement("span", "cd-back__track-title");
            TrackTitleElement.textContent = Track.TrackName;
            const TrackLengthElement = CreateElement("span", "cd-back__track-length");
            TrackLengthElement.textContent = Track.TrackLength || "";
            TrackElement.append(TrackNumberElement, TrackTitleElement, TrackLengthElement);
            TrackListElement.appendChild(TrackElement);
        });

        const BackFooterElement = CreateElement("div", "cd-back__footer");
        const FooterTextElement = CreateElement("span", "");
        FooterTextElement.textContent = `${Album.ArtistName}${Album.AlbumYear ? ` · ${Album.AlbumYear}` : ""}`;
        BackFooterElement.append(FooterTextElement, CreateElement("span", "cd-back__barcode", { "aria-hidden": "true" }));

        BackBodyElement.append(BackHeadingElement, TrackListElement, BackFooterElement);
        AlbumBackElement.append(LeftSpineElement, BackBodyElement, RightSpineElement, CreateElement("span", "cd-gloss", { "aria-hidden": "true" }));
        return AlbumBackElement;
    }

    // The photo of the real back replaces the tray card once it is found
    function CreateAlbumBackPhotoElement(PhotoUrl) {
        const AlbumBackPhotoElement = CreateElement("div", "cd-face cd-back cd-back--photo");
        AlbumBackPhotoElement.appendChild(CreateElement("img", "", { src: PhotoUrl, alt: "", draggable: "false" }));
        AlbumBackPhotoElement.appendChild(CreateElement("span", "cd-gloss", { "aria-hidden": "true" }));
        return AlbumBackPhotoElement;
    }

    // Tint the popup's tray card with the cover's average colour
    const SharedTintCanvas = document.createElement("canvas");
    SharedTintCanvas.width = SharedTintCanvas.height = 8;
    const SharedTintContext = SharedTintCanvas.getContext("2d", { willReadFrequently: true });

    const AlbumTintCache = new Map(); // AlbumId -> colour

    function ApplyAlbumTintFromCover(CoverImageElement, AlbumElement) {
        const AlbumId = AlbumElement.dataset.albumId;
        if (AlbumTintCache.has(AlbumId)) {
            AlbumElement.style.setProperty("--album-tint", AlbumTintCache.get(AlbumId));
            return;
        }
        try {
            SharedTintContext.clearRect(0, 0, 8, 8);
            SharedTintContext.drawImage(CoverImageElement, 0, 0, 8, 8);
            const TintPixels = SharedTintContext.getImageData(0, 0, 8, 8).data;
            let Red = 0, Green = 0, Blue = 0;
            for (let PixelOffset = 0; PixelOffset < TintPixels.length; PixelOffset += 4) {
                Red += TintPixels[PixelOffset];
                Green += TintPixels[PixelOffset + 1];
                Blue += TintPixels[PixelOffset + 2];
            }
            const PixelCount = TintPixels.length / 4;
            const AlbumTint = `rgb(${Math.round(Red / PixelCount)}, ${Math.round(Green / PixelCount)}, ${Math.round(Blue / PixelCount)})`;
            AlbumTintCache.set(AlbumId, AlbumTint);
            AlbumElement.style.setProperty("--album-tint", AlbumTint);
        } catch (TintError) {
            /* Cross-origin cover images cannot be sampled; the default tint is used. */
        }
    }

    /* ------------------------------------------------------------------ */
    /* 6. Camera: position, inertia and zoom of the wall                  */
    /* ------------------------------------------------------------------ */

    const CameraState = {
        CurrentX: 0, CurrentY: 0,
        TargetX: 0, TargetY: 0,
        VelocityX: 0, VelocityY: 0,
        CurrentScale: 1,      // zoom level of the wall
        IsDragging: false,
        IsAnimating: false,
        LastFrameTime: 0,
    };

    const KEYBOARD_DIRECTIONS = {
        ArrowLeft: [1, 0], KeyA: [1, 0],
        ArrowRight: [-1, 0], KeyD: [-1, 0],
        ArrowUp: [0, 1], KeyW: [0, 1],
        ArrowDown: [0, -1], KeyS: [0, -1],
    };
    const HeldPanKeys = new Set();

    function WriteCameraTransform() {
        ShelfWallElement.style.transform = `translate3d(${CameraState.CurrentX.toFixed(2)}px, ${CameraState.CurrentY.toFixed(2)}px, 0) scale(${CameraState.CurrentScale.toFixed(4)})`;
        UpdateVisibleTiles();
    }

    // While the wall moves it is kept on its own GPU layer (smooth); once it rests for a moment the
    // layer hint is dropped so the browser redraws it sharply at the current zoom.
    let RestingLayerTimeoutId = null;
    function MarkWallMoving() {
        clearTimeout(RestingLayerTimeoutId);
        if (ShelfWallElement.style.willChange !== "transform") ShelfWallElement.style.willChange = "transform";
    }
    function MarkWallResting() {
        clearTimeout(RestingLayerTimeoutId);
        RestingLayerTimeoutId = setTimeout(() => { ShelfWallElement.style.willChange = ""; }, 300);
    }

    function RequestCameraFrame() {
        MarkWallMoving();
        if (CameraState.IsAnimating) return;
        CameraState.IsAnimating = true;
        CameraState.LastFrameTime = performance.now();
        requestAnimationFrame(RunCameraFrame);
    }

    function RunCameraFrame(FrameTime) {
        const FrameScale = ClampNumber((FrameTime - CameraState.LastFrameTime) / 16.667, 0.25, 4);
        CameraState.LastFrameTime = FrameTime;

        if (HeldPanKeys.size && !IsAlbumDetailsOpen()) {
            let DirectionX = 0, DirectionY = 0;
            HeldPanKeys.forEach((KeyCode) => {
                DirectionX += KEYBOARD_DIRECTIONS[KeyCode][0];
                DirectionY += KEYBOARD_DIRECTIONS[KeyCode][1];
            });
            const DesiredVelocityX = ClampNumber(DirectionX, -1, 1) * ShelfConfig.KeyboardPanSpeed;
            const DesiredVelocityY = ClampNumber(DirectionY, -1, 1) * ShelfConfig.KeyboardPanSpeed;
            CameraState.VelocityX += (DesiredVelocityX - CameraState.VelocityX) * 0.18 * FrameScale;
            CameraState.VelocityY += (DesiredVelocityY - CameraState.VelocityY) * 0.18 * FrameScale;
        }

        if (!CameraState.IsDragging) {
            CameraState.TargetX += CameraState.VelocityX * FrameScale;
            CameraState.TargetY += CameraState.VelocityY * FrameScale;
            if (!HeldPanKeys.size) {
                const FrictionThisFrame = Math.pow(ShelfConfig.PanFriction, FrameScale);
                CameraState.VelocityX *= FrictionThisFrame;
                CameraState.VelocityY *= FrictionThisFrame;
            }
        }

        const Smoothing = CameraState.IsDragging ? 0.5 : ShelfConfig.PanSmoothing;
        const FollowAmount = PrefersReducedMotion ? 1 : 1 - Math.pow(1 - Smoothing, FrameScale);
        CameraState.CurrentX += (CameraState.TargetX - CameraState.CurrentX) * FollowAmount;
        CameraState.CurrentY += (CameraState.TargetY - CameraState.CurrentY) * FollowAmount;

        const IsSettled =
            !CameraState.IsDragging && !HeldPanKeys.size &&
            Math.abs(CameraState.TargetX - CameraState.CurrentX) < 0.1 &&
            Math.abs(CameraState.TargetY - CameraState.CurrentY) < 0.1 &&
            Math.abs(CameraState.VelocityX) < 0.05 && Math.abs(CameraState.VelocityY) < 0.05;

        if (IsSettled) {
            CameraState.CurrentX = CameraState.TargetX = Math.round(CameraState.TargetX);
            CameraState.CurrentY = CameraState.TargetY = Math.round(CameraState.TargetY);
            CameraState.VelocityX = CameraState.VelocityY = 0;
            WriteCameraTransform();
            CameraState.IsAnimating = false;
            MarkWallResting();
            return;
        }
        WriteCameraTransform();
        requestAnimationFrame(RunCameraFrame);
    }

    // --- Zoom (pinch, trackpad, Ctrl / Cmd + scroll) ---

    // Change the zoom while keeping the point under (FocusX, FocusY) on the screen still
    function ZoomCameraAboutPoint(NewScale, FocusX, FocusY) {
        const ClampedScale = ClampNumber(NewScale, ShelfConfig.MinimumZoom, ShelfConfig.MaximumZoom);
        const ScaleRatio = ClampedScale / CameraState.CurrentScale;
        if (ScaleRatio === 1) return;
        CameraState.CurrentX = FocusX - (FocusX - CameraState.CurrentX) * ScaleRatio;
        CameraState.CurrentY = FocusY - (FocusY - CameraState.CurrentY) * ScaleRatio;
        CameraState.TargetX = FocusX - (FocusX - CameraState.TargetX) * ScaleRatio;
        CameraState.TargetY = FocusY - (FocusY - CameraState.TargetY) * ScaleRatio;
        CameraState.CurrentScale = ClampedScale;
        WriteCameraTransform();
        RequestCameraFrame();
    }

    // Middle of the part of the screen the footer does not cover
    function GetVisibleWallCentre() {
        return { CentreX: window.innerWidth / 2, CentreY: (window.innerHeight - GetFooterHeight()) / 2 };
    }

    // Two-finger pinch on touch screens
    const ActiveTouchPoints = new Map(); // pointerId -> { X, Y }
    let PinchState = null;               // { StartDistance, StartScale, LastMidX, LastMidY }

    function GetPinchGeometry() {
        const [FirstPoint, SecondPoint] = Array.from(ActiveTouchPoints.values());
        return {
            Distance: Math.max(1, Math.hypot(SecondPoint.X - FirstPoint.X, SecondPoint.Y - FirstPoint.Y)),
            MidX: (FirstPoint.X + SecondPoint.X) / 2,
            MidY: (FirstPoint.Y + SecondPoint.Y) / 2,
        };
    }

    function StartPinch() {
        const { Distance, MidX, MidY } = GetPinchGeometry();
        PinchState = { StartDistance: Distance, StartScale: CameraState.CurrentScale, LastMidX: MidX, LastMidY: MidY };
        // A pinch is never a tap or a drag
        PointerState.PressedAlbumElement = null;
        PointerState.HasMovedBeyondTapThreshold = true;
        CameraState.IsDragging = false;
        CameraState.VelocityX = CameraState.VelocityY = 0;
        CameraState.TargetX = CameraState.CurrentX;
        CameraState.TargetY = CameraState.CurrentY;
    }

    function UpdatePinch() {
        const { Distance, MidX, MidY } = GetPinchGeometry();
        // Move with the fingers, then zoom around the point between them
        CameraState.CurrentX += MidX - PinchState.LastMidX;
        CameraState.CurrentY += MidY - PinchState.LastMidY;
        CameraState.TargetX = CameraState.CurrentX;
        CameraState.TargetY = CameraState.CurrentY;
        PinchState.LastMidX = MidX;
        PinchState.LastMidY = MidY;
        ZoomCameraAboutPoint(PinchState.StartScale * (Distance / PinchState.StartDistance), MidX, MidY);
        WriteCameraTransform();
        RequestCameraFrame();
    }

    // Safari on Mac sends trackpad pinches as gesture events
    let GestureStartScale = 1;
    function HandleGestureStart(GestureEvent) {
        GestureEvent.preventDefault();
        GestureStartScale = CameraState.CurrentScale;
    }
    function HandleGestureChange(GestureEvent) {
        GestureEvent.preventDefault();
        if (IsAlbumDetailsOpen()) return;
        ZoomCameraAboutPoint(GestureStartScale * GestureEvent.scale, GestureEvent.clientX, GestureEvent.clientY);
    }

    function PanCameraBy(DeltaX, DeltaY) {
        CameraState.TargetX += DeltaX;
        CameraState.TargetY += DeltaY;
        RequestCameraFrame();
    }

    // Glide the wall so an album sits in the middle of the screen
    function CentreAlbumOnScreen(AlbumElement) {
        const AlbumRect = AlbumElement.getBoundingClientRect();
        const { CentreX, CentreY } = GetVisibleWallCentre();
        const ShiftX = CentreX - (AlbumRect.left + AlbumRect.width / 2);
        const ShiftY = CentreY - (AlbumRect.top + AlbumRect.height / 2);
        CameraState.VelocityX = CameraState.VelocityY = 0;
        CameraState.TargetX = CameraState.CurrentX; // measure from where the wall is drawn now
        CameraState.TargetY = CameraState.CurrentY;
        PanCameraBy(ShiftX, ShiftY);
    }

    // Bring an element fully into view (keyboard focus)
    function PanElementIntoView(TargetElement, MarginPx = 24) {
        const ElementRect = TargetElement.getBoundingClientRect();
        let ShiftX = 0, ShiftY = 0;
        if (ElementRect.left < MarginPx) ShiftX = MarginPx - ElementRect.left;
        else if (ElementRect.right > window.innerWidth - MarginPx) ShiftX = window.innerWidth - MarginPx - ElementRect.right;
        if (ElementRect.top < MarginPx) ShiftY = MarginPx - ElementRect.top;
        else if (ElementRect.bottom > window.innerHeight - GetFooterHeight() - MarginPx) ShiftY = window.innerHeight - GetFooterHeight() - MarginPx - ElementRect.bottom;
        if (ShiftX || ShiftY) {
            CameraState.VelocityX = CameraState.VelocityY = 0;
            PanCameraBy(ShiftX, ShiftY);
        }
    }

    /* ------------------------------------------------------------------ */
    /* 7. Input: pointer drag / tap, wheel, keyboard                      */
    /* ------------------------------------------------------------------ */

    const PointerState = {
        ActivePointerId: null,
        StartX: 0, StartY: 0,
        LastX: 0, LastY: 0,
        LastMoveTime: 0,
        HasMovedBeyondTapThreshold: false,
        PressedAlbumElement: null,
    };
    const TAP_MOVEMENT_THRESHOLD_PX = 8;

    function HandlePointerDown(PointerEvent) {
        if (PointerEvent.pointerType === "touch") {
            ActiveTouchPoints.set(PointerEvent.pointerId, { X: PointerEvent.clientX, Y: PointerEvent.clientY });
            if (ActiveTouchPoints.size === 2) {
                try { ListeningRoomElement.setPointerCapture(PointerEvent.pointerId); } catch (CaptureError) { /* ignore */ }
                StartPinch();
                return;
            }
        }
        if (PointerState.ActivePointerId !== null) return;
        if (PointerEvent.pointerType === "mouse" && PointerEvent.button !== 0) return;
        if (PointerEvent.pointerType === "mouse") PointerEvent.preventDefault();

        PointerState.ActivePointerId = PointerEvent.pointerId;
        PointerState.StartX = PointerState.LastX = PointerEvent.clientX;
        PointerState.StartY = PointerState.LastY = PointerEvent.clientY;
        PointerState.LastMoveTime = performance.now();
        PointerState.HasMovedBeyondTapThreshold = false;
        PointerState.PressedAlbumElement = PointerEvent.target.closest ? PointerEvent.target.closest(".cd") : null;

        CameraState.VelocityX = CameraState.VelocityY = 0;
        CameraState.TargetX = CameraState.CurrentX; // catch the wall where it is
        CameraState.TargetY = CameraState.CurrentY;
        try { ListeningRoomElement.setPointerCapture(PointerEvent.pointerId); } catch (CaptureError) { /* ignore */ }
    }

    function HandlePointerMove(PointerEvent) {
        if (ActiveTouchPoints.has(PointerEvent.pointerId)) {
            ActiveTouchPoints.set(PointerEvent.pointerId, { X: PointerEvent.clientX, Y: PointerEvent.clientY });
            if (PinchState) {
                if (ActiveTouchPoints.size >= 2) UpdatePinch();
                return;
            }
        }
        if (PointerEvent.pointerId !== PointerState.ActivePointerId) return;
        const DeltaX = PointerEvent.clientX - PointerState.LastX;
        const DeltaY = PointerEvent.clientY - PointerState.LastY;

        if (!PointerState.HasMovedBeyondTapThreshold) {
            const DistanceFromStart = Math.hypot(PointerEvent.clientX - PointerState.StartX, PointerEvent.clientY - PointerState.StartY);
            if (DistanceFromStart < TAP_MOVEMENT_THRESHOLD_PX) return;
            PointerState.HasMovedBeyondTapThreshold = true;
            CameraState.IsDragging = true;
            ListeningRoomElement.classList.add("is-dragging");
        }

        const Now = performance.now();
        const ElapsedMs = Math.max(1, Now - PointerState.LastMoveTime);
        PointerState.LastX = PointerEvent.clientX;
        PointerState.LastY = PointerEvent.clientY;
        PointerState.LastMoveTime = Now;

        CameraState.TargetX += DeltaX;
        CameraState.TargetY += DeltaY;

        const InstantVelocityX = (DeltaX / ElapsedMs) * 16.667;
        const InstantVelocityY = (DeltaY / ElapsedMs) * 16.667;
        CameraState.VelocityX = CameraState.VelocityX * 0.6 + InstantVelocityX * 0.4;
        CameraState.VelocityY = CameraState.VelocityY * 0.6 + InstantVelocityY * 0.4;
        RequestCameraFrame();
    }

    function HandlePointerUp(PointerEvent) {
        ActiveTouchPoints.delete(PointerEvent.pointerId);
        if (PinchState) {
            // The pinch ends when a finger lifts; the other finger is ignored until it lifts too
            if (ActiveTouchPoints.size < 2) {
                PinchState = null;
                PointerState.ActivePointerId = null;
                ListeningRoomElement.classList.remove("is-dragging");
            }
            return;
        }
        if (PointerEvent.pointerId !== PointerState.ActivePointerId) return;
        PointerState.ActivePointerId = null;
        ListeningRoomElement.classList.remove("is-dragging");

        if (PointerState.HasMovedBeyondTapThreshold) {
            CameraState.IsDragging = false;
            if (performance.now() - PointerState.LastMoveTime > 90 || PointerEvent.type === "pointercancel") {
                CameraState.VelocityX = CameraState.VelocityY = 0;
            }
            CameraState.VelocityX = ClampNumber(CameraState.VelocityX, -90, 90);
            CameraState.VelocityY = ClampNumber(CameraState.VelocityY, -90, 90);
            RequestCameraFrame();
        } else if (PointerEvent.type === "pointerup") {
            HandleAlbumTap(PointerState.PressedAlbumElement);
        }
        PointerState.PressedAlbumElement = null;
    }

    function HandleWheel(WheelEvent) {
        if (IsAlbumDetailsOpen()) return;
        WheelEvent.preventDefault();
        const DeltaModeScale = WheelEvent.deltaMode === 1 ? 16 : WheelEvent.deltaMode === 2 ? window.innerHeight : 1;
        let DeltaX = WheelEvent.deltaX * DeltaModeScale;
        let DeltaY = WheelEvent.deltaY * DeltaModeScale;
        // Trackpad pinches arrive as wheel events with ctrlKey; Ctrl / Cmd + scroll zooms with a mouse
        if (WheelEvent.ctrlKey || WheelEvent.metaKey) {
            ZoomCameraAboutPoint(CameraState.CurrentScale * Math.exp(-ClampNumber(DeltaY, -60, 60) * 0.01), WheelEvent.clientX, WheelEvent.clientY);
            return;
        }
        if (WheelEvent.shiftKey && !DeltaX) { DeltaX = DeltaY; DeltaY = 0; }
        CameraState.VelocityX = CameraState.VelocityY = 0;
        PanCameraBy(-DeltaX * ShelfConfig.WheelPanMultiplier, -DeltaY * ShelfConfig.WheelPanMultiplier);
    }

    function HandleKeyDown(KeyboardEvent) {
        if (KeyboardEvent.metaKey || KeyboardEvent.ctrlKey || KeyboardEvent.altKey) return;

        if (KeyboardEvent.key === "Escape") {
            if (IsAlbumDetailsOpen()) CloseAlbumDetails();
            return;
        }
        if (IsAlbumDetailsOpen()) return;
        if (CollectionFooterElements.Footer && CollectionFooterElements.Footer.contains(document.activeElement)) return;

        if (KEYBOARD_DIRECTIONS[KeyboardEvent.code]) {
            KeyboardEvent.preventDefault();
            HeldPanKeys.add(KeyboardEvent.code);
            RequestCameraFrame();
            return;
        }

        const FocusedAlbumElement = document.activeElement && document.activeElement.closest && document.activeElement.closest(".cd");
        if (!FocusedAlbumElement) return;
        if (KeyboardEvent.key === "Enter" || KeyboardEvent.key === " ") {
            KeyboardEvent.preventDefault();
            OpenAlbumDetails(FocusedAlbumElement, true);
        }
    }

    function HandleKeyUp(KeyboardEvent) {
        HeldPanKeys.delete(KeyboardEvent.code);
    }

    /* ------------------------------------------------------------------ */
    /* 8. Album taps                                                      */
    /* ------------------------------------------------------------------ */

    // One click / tap: glide the CD to the middle of the wall and open its details
    function HandleAlbumTap(AlbumElement) {
        if (!AlbumElement) return;
        CentreAlbumOnScreen(AlbumElement);
        OpenAlbumDetails(AlbumElement);
    }

    function HandleAlbumFocus(FocusEvent) {
        const AlbumElement = FocusEvent.target.closest && FocusEvent.target.closest(".cd");
        if (!AlbumElement) return;
        let IsKeyboardFocus = true;
        try { IsKeyboardFocus = AlbumElement.matches(":focus-visible"); } catch (SelectorError) { /* old browser */ }
        if (IsKeyboardFocus) PanElementIntoView(AlbumElement, 48);
    }

    /* ------------------------------------------------------------------ */
    /* 9. Album details popup (click the case to flip it)                 */
    /* ------------------------------------------------------------------ */

    const AlbumDetailsElements = {
        Popup: document.getElementById("AlbumDetailsPopup"),
        Cover: document.getElementById("AlbumDetailsCover"),
        Meta: document.getElementById("AlbumDetailsMeta"),
        Title: document.getElementById("AlbumDetailsTitle"),
        Artist: document.getElementById("AlbumDetailsArtist"),
        Spotify: document.getElementById("AlbumDetailsSpotify"),
        CloseButton: document.querySelector("#AlbumDetailsPopup .album-details__close"),
        Case: document.getElementById("AlbumDetailsCase"),
        Front: document.getElementById("AlbumDetailsFront"),
        FrontSlotNumber: document.getElementById("AlbumDetailsSlotNumber"),
        Scroll: document.getElementById("AlbumDetailsScroll"),
        Tracks: document.getElementById("AlbumDetailsTracks"),
        Runtime: document.getElementById("AlbumDetailsRuntime"),
        Back: document.getElementById("AlbumDetailsBack"),
    };
    let AlbumDetailsReturnFocusElement = null;
    let AlbumDetailsHideTimeoutId = null;

    function IsAlbumDetailsOpen() {
        return !AlbumDetailsElements.Popup.hidden;
    }

    function OpenAlbumDetails(AlbumElement, OpenedWithKeyboard = false) {
        const Album = AlbumById.get(AlbumElement.dataset.albumId);
        if (!Album) return;

        const MetaParts = [Album.AlbumYear, GetTrackCountText(Album), GetAlbumLengthText(Album)].filter(Boolean);

        // Front: the uploaded photo, or an empty slot showing the album number
        AlbumDetailsElements.Case.dataset.albumId = Album.AlbumId;
        AlbumDetailsElements.Cover.removeAttribute("src");
        AlbumDetailsElements.Cover.alt = `${Album.AlbumName} cover`;
        AlbumDetailsElements.FrontSlotNumber.textContent = Album.AlbumNumberText;
        FillPhotoSlot(AlbumDetailsElements.Cover, AlbumDetailsElements.Front, Album.FrontCoverImage);
        // Back: the tracklist tray card, swapped for the photo of the real back if one is uploaded
        SetAlbumDetailsBack(CreateAlbumBackElement(Album));
        ResolvePhoto(Album.BackCoverImage).then((PhotoUrl) => {
            if (PhotoUrl && AlbumDetailsElements.Case.dataset.albumId === Album.AlbumId) SetAlbumDetailsBack(CreateAlbumBackPhotoElement(PhotoUrl));
        });
        AlbumDetailsElements.Case.style.setProperty("--album-tint", AlbumTintCache.get(Album.AlbumId) || "#6d4a33");
        if (!AlbumTintCache.has(Album.AlbumId)) {
            AlbumDetailsElements.Cover.addEventListener("load", () => ApplyAlbumTintFromCover(AlbumDetailsElements.Cover, AlbumDetailsElements.Case), { once: true });
        }
        SetAlbumDetailsCaseFlipped(false);
        RenderAlbumDetailsTracklist(Album);
        AlbumDetailsElements.Scroll.scrollTop = 0;
        AlbumDetailsElements.Meta.textContent = MetaParts.join("  ·  ");
        AlbumDetailsElements.Title.textContent = Album.AlbumName;
        AlbumDetailsElements.Artist.textContent = Album.ArtistName;
        AlbumDetailsElements.Artist.href = GetSpotifyArtistUrl(Album);
        AlbumDetailsElements.Artist.setAttribute("aria-label", `${Album.ArtistName} on Spotify (opens in a new tab)`);
        AlbumDetailsElements.Spotify.href = GetSpotifyAlbumUrl(Album);

        clearTimeout(AlbumDetailsHideTimeoutId);
        AlbumDetailsReturnFocusElement = AlbumElement;
        HeldPanKeys.clear();
        AlbumDetailsElements.Popup.hidden = false;
        requestAnimationFrame(() => requestAnimationFrame(() => AlbumDetailsElements.Popup.classList.add("is-open")));
        if (OpenedWithKeyboard) AlbumDetailsElements.CloseButton.focus({ preventScroll: true });
        else AlbumDetailsElements.Popup.querySelector(".album-details__panel").focus({ preventScroll: true });
    }

    function SetAlbumDetailsBack(NewBackElement) {
        NewBackElement.id = "AlbumDetailsBack";
        AlbumDetailsElements.Back.replaceWith(NewBackElement);
        AlbumDetailsElements.Back = NewBackElement;
    }

    function CloseAlbumDetails() {
        if (!IsAlbumDetailsOpen()) return;
        AlbumDetailsElements.Popup.classList.remove("is-open");
        AlbumDetailsHideTimeoutId = setTimeout(() => { AlbumDetailsElements.Popup.hidden = true; }, PrefersReducedMotion ? 0 : 380);
        if (AlbumDetailsReturnFocusElement) AlbumDetailsReturnFocusElement.focus({ preventScroll: true });
    }

    // Full tracklist under the album details (scroll down inside the popup to read it)
    function RenderAlbumDetailsTracklist(Album) {
        const TrackFragment = document.createDocumentFragment();
        Album.TrackList.forEach((Track, TrackIndex) => {
            const TrackElement = CreateElement("li", "album-details__track");
            const TrackNumberElement = CreateElement("span", "album-details__track-number");
            TrackNumberElement.textContent = String(TrackIndex + 1).padStart(2, "0");
            const TrackTitleElement = CreateElement("span", "album-details__track-title");
            TrackTitleElement.textContent = Track.TrackName;
            const TrackLengthElement = CreateElement("span", "album-details__track-length");
            TrackLengthElement.textContent = Track.TrackLength || "";
            TrackElement.append(TrackNumberElement, TrackTitleElement, TrackLengthElement);
            TrackFragment.appendChild(TrackElement);
        });
        AlbumDetailsElements.Tracks.replaceChildren(TrackFragment);
        AlbumDetailsElements.Tracks.parentElement.hidden = Album.TrackList.length === 0;
        AlbumDetailsElements.Runtime.textContent = [
            Album.AlbumDate ? `Released ${Album.AlbumDate}` : "",
            GetTrackCountText(Album),
            GetAlbumLengthText(Album),
        ].filter(Boolean).join(" · ");
    }

    function SetAlbumDetailsCaseFlipped(ShouldBeFlipped) {
        AlbumDetailsElements.Case.classList.toggle("is-flipped", ShouldBeFlipped);
        AlbumDetailsElements.Case.setAttribute("aria-pressed", String(ShouldBeFlipped));
        AlbumDetailsElements.Case.setAttribute("aria-label", ShouldBeFlipped ? "Flip the case back to the cover" : "Flip the case to see the tracklist");
    }

    function ToggleAlbumDetailsCase() {
        SetAlbumDetailsCaseFlipped(!AlbumDetailsElements.Case.classList.contains("is-flipped"));
    }

    function HandleAlbumDetailsClick(ClickEvent) {
        if (ClickEvent.target.closest("[data-close-popup]")) CloseAlbumDetails();
        else if (ClickEvent.target.closest("#AlbumDetailsCase")) ToggleAlbumDetailsCase();
    }

    function HandleAlbumDetailsKeyDown(KeyboardEvent) {
        if (document.activeElement === AlbumDetailsElements.Case && (KeyboardEvent.key === "Enter" || KeyboardEvent.key === " ")) {
            KeyboardEvent.preventDefault();
            ToggleAlbumDetailsCase();
        }
    }

    // Keep keyboard focus inside the popup while it is open
    function TrapAlbumDetailsFocus(KeyboardEvent) {
        if (KeyboardEvent.key !== "Tab" || !IsAlbumDetailsOpen()) return;
        const FocusableElements = [AlbumDetailsElements.CloseButton, AlbumDetailsElements.Case, AlbumDetailsElements.Artist, AlbumDetailsElements.Spotify];
        const CurrentIndex = FocusableElements.indexOf(document.activeElement);
        KeyboardEvent.preventDefault();
        const NextIndex = (CurrentIndex + (KeyboardEvent.shiftKey ? -1 : 1) + FocusableElements.length) % FocusableElements.length;
        FocusableElements[NextIndex].focus();
    }

    /* ------------------------------------------------------------------ */
    /* 10. Collection footer: A–Z / Z–A list; minimise / rest / expand    */
    /* ------------------------------------------------------------------ */

    const CollectionFooterElements = {
        Footer: document.getElementById("CollectionFooter"),
        Heading: document.getElementById("CollectionFooterHeading"),
        Text: document.getElementById("CollectionFooterText"),
        Count: document.getElementById("CollectionFooterCount"),
        List: document.getElementById("CollectionFooterList"),
        Inner: document.getElementById("CollectionFooterInner"),
        RaiseButton: document.querySelector('#CollectionFooter [data-footer-step="up"]'),
        LowerButton: document.querySelector('#CollectionFooter [data-footer-step="down"]'),
        SortButtons: Array.from(document.querySelectorAll("#CollectionFooter [data-sort-direction]")),
        Search: document.getElementById("CollectionSearch"),
        NoResults: document.getElementById("CollectionNoResults"),
    };
    let CollectionListSortDirection = "ascending";

    // The footer has three heights; the arrows / swipes step between them
    const FOOTER_STATES = ["Minimised", "Resting", "Expanded"];
    const FOOTER_SWIPE_THRESHOLD_PX = 28;
    let CollectionFooterState = "Resting";
    let FooterSwipe = null;              // { PointerId, StartY, HasStepped }
    let ShouldIgnoreNextFooterClick = false;

    function GetFooterHeight() {
        if (!CollectionFooterElements.Footer || CollectionFooterState === "Minimised") return 0;
        return CollectionFooterElements.Footer.offsetHeight;
    }

    function SetCollectionFooterState(NewFooterState) {
        CollectionFooterState = NewFooterState;
        const FooterElement = CollectionFooterElements.Footer;
        FooterElement.classList.toggle("is-minimised", NewFooterState === "Minimised");
        FooterElement.classList.toggle("is-expanded", NewFooterState === "Expanded");
        if (NewFooterState === "Minimised") {
            if (CollectionFooterElements.Inner.contains(document.activeElement)) CollectionFooterElements.RaiseButton.focus({ preventScroll: true });
            CollectionFooterElements.Inner.setAttribute("inert", "");
        } else {
            CollectionFooterElements.Inner.removeAttribute("inert");
        }
        CollectionFooterElements.RaiseButton.disabled = NewFooterState === "Expanded";
        CollectionFooterElements.LowerButton.disabled = NewFooterState === "Minimised";
        CollectionFooterElements.RaiseButton.setAttribute("aria-label", NewFooterState === "Minimised" ? "Show the collection footer" : "Show the full collection list");
        CollectionFooterElements.LowerButton.setAttribute("aria-label", NewFooterState === "Expanded" ? "Show less of the collection list" : "Minimise the collection footer");
    }

    // +1 = raise, -1 = lower
    function StepCollectionFooter(StepDirection) {
        const CurrentIndex = FOOTER_STATES.indexOf(CollectionFooterState);
        const NextIndex = ClampNumber(CurrentIndex + StepDirection, 0, FOOTER_STATES.length - 1);
        if (NextIndex !== CurrentIndex) SetCollectionFooterState(FOOTER_STATES[NextIndex]);
    }

    // Swipe (touch) or drag (mouse) up / down on the tab or heading area
    function HandleFooterPointerDown(PointerEvent) {
        ShouldIgnoreNextFooterClick = false;
        if (!PointerEvent.target.closest(".collection-footer__tab, .collection-footer__header")) return;
        if (PointerEvent.target.closest("input")) return; // typing in the search box is not a swipe
        FooterSwipe = { PointerId: PointerEvent.pointerId, StartY: PointerEvent.clientY, HasStepped: false };
    }

    function HandleFooterPointerMove(PointerEvent) {
        if (!FooterSwipe || PointerEvent.pointerId !== FooterSwipe.PointerId || FooterSwipe.HasStepped) return;
        const DistanceY = PointerEvent.clientY - FooterSwipe.StartY;
        if (Math.abs(DistanceY) < FOOTER_SWIPE_THRESHOLD_PX) return;
        FooterSwipe.HasStepped = true;
        ShouldIgnoreNextFooterClick = true; // the swipe should not also count as a tap on a button
        StepCollectionFooter(DistanceY < 0 ? 1 : -1);
    }

    function HandleFooterPointerEnd(PointerEvent) {
        if (FooterSwipe && PointerEvent.pointerId === FooterSwipe.PointerId) FooterSwipe = null;
    }

    function SortAlbumsForList(AlbumList, SortDirection) {
        const StripLeadingThe = (Text) => String(Text).replace(/^the\s+/i, "");
        const SortedAlbums = AlbumList.slice().sort((A, B) =>
            StripLeadingThe(A.AlbumName).localeCompare(StripLeadingThe(B.AlbumName), undefined, { sensitivity: "base" }) ||
            StripLeadingThe(A.ArtistName).localeCompare(StripLeadingThe(B.ArtistName), undefined, { sensitivity: "base" })
        );
        return SortDirection === "descending" ? SortedAlbums.reverse() : SortedAlbums;
    }

    // Search matches album, artist or year; every word typed must match somewhere
    function DoesAlbumMatchSearch(Album, SearchText) {
        const SearchWords = SearchText.toLowerCase().split(/\s+/).filter(Boolean);
        if (!SearchWords.length) return true;
        const AlbumText = `${Album.AlbumName} ${Album.ArtistName} ${Album.AlbumYear} ${Album.AlbumDate}`.toLowerCase();
        return SearchWords.every((SearchWord) => AlbumText.includes(SearchWord));
    }

    function RenderCollectionList() {
        const ListFragment = document.createDocumentFragment();
        const SearchText = CollectionFooterElements.Search ? CollectionFooterElements.Search.value.trim() : "";
        const MatchingAlbums = SortAlbumsForList(AlbumCollection, CollectionListSortDirection).filter((Album) => DoesAlbumMatchSearch(Album, SearchText));
        CollectionFooterElements.NoResults.hidden = MatchingAlbums.length > 0;
        CollectionFooterElements.Count.textContent = SearchText
            ? `${MatchingAlbums.length} of ${AlbumCollection.length}`
            : `${AlbumCollection.length} ${AlbumCollection.length === 1 ? "CD" : "CDs"}`;
        MatchingAlbums.forEach((Album) => {
            const ListItemElement = CreateElement("li", "collection-list__item");
            const AlbumButtonElement = CreateElement("button", "collection-list__button", {
                type: "button",
                "data-album-id": Album.AlbumId,
                "aria-label": `Find ${Album.AlbumName} by ${Album.ArtistName} on the wall`,
            });
            const ThumbnailElement = CreateElement("img", "collection-list__cover", { alt: "", loading: "lazy", decoding: "async", draggable: "false" });
            FillPhotoSlot(ThumbnailElement, ThumbnailElement, Album.FrontCoverImage);
            const TextWrapElement = CreateElement("span", "collection-list__text");
            const AlbumNameElement = CreateElement("span", "collection-list__album");
            AlbumNameElement.textContent = Album.AlbumName;
            const ArtistLineElement = CreateElement("span", "collection-list__artist");
            ArtistLineElement.textContent = Album.AlbumYear ? `${Album.ArtistName} · ${Album.AlbumYear}` : Album.ArtistName;
            TextWrapElement.append(AlbumNameElement, ArtistLineElement);
            AlbumButtonElement.append(ThumbnailElement, TextWrapElement);
            ListItemElement.appendChild(AlbumButtonElement);
            ListFragment.appendChild(ListItemElement);
        });
        CollectionFooterElements.List.replaceChildren(ListFragment);
        CollectionFooterElements.SortButtons.forEach((SortButton) => {
            SortButton.setAttribute("aria-pressed", String(SortButton.dataset.sortDirection === CollectionListSortDirection));
        });
    }

    // Find the copy of an album nearest the middle of the screen, centre it and open its details
    function FindAlbumOnWall(AlbumId) {
        const { CentreX: ScreenCentreX, CentreY: ScreenCentreY } = GetVisibleWallCentre();
        let NearestAlbumElement = null, NearestDistance = Infinity;
        ShelfWallElement.querySelectorAll(`.cd[data-album-id="${CSS.escape(AlbumId)}"]`).forEach((AlbumElement) => {
            const AlbumRect = AlbumElement.getBoundingClientRect();
            const Distance = Math.hypot(AlbumRect.left + AlbumRect.width / 2 - ScreenCentreX, AlbumRect.top + AlbumRect.height / 2 - ScreenCentreY);
            if (Distance < NearestDistance) { NearestDistance = Distance; NearestAlbumElement = AlbumElement; }
        });
        if (!NearestAlbumElement) return;
        CentreAlbumOnScreen(NearestAlbumElement);
        OpenAlbumDetails(NearestAlbumElement);
    }

    function HandleCollectionFooterClick(ClickEvent) {
        if (ShouldIgnoreNextFooterClick) {
            ShouldIgnoreNextFooterClick = false;
            return;
        }
        const StepButton = ClickEvent.target.closest("[data-footer-step]");
        if (StepButton) {
            StepCollectionFooter(StepButton.dataset.footerStep === "up" ? 1 : -1);
            return;
        }
        const SortButton = ClickEvent.target.closest("[data-sort-direction]");
        if (SortButton) {
            CollectionListSortDirection = SortButton.dataset.sortDirection;
            RenderCollectionList();
            CollectionFooterElements.List.scrollTop = 0;
            return;
        }
        const AlbumButton = ClickEvent.target.closest(".collection-list__button");
        if (AlbumButton) {
            if (CollectionFooterState === "Expanded") SetCollectionFooterState("Resting");
            FindAlbumOnWall(AlbumButton.dataset.albumId);
        }
    }

    function SetUpCollectionFooter() {
        if (!CollectionFooterElements.Footer) return;
        CollectionFooterElements.Heading.textContent = ShelfConfig.FooterHeading;
        CollectionFooterElements.Text.textContent = ShelfConfig.FooterText;
        CollectionFooterElements.Text.hidden = !ShelfConfig.FooterText;
        RenderCollectionList();
        CollectionFooterElements.Search.addEventListener("input", () => {
            RenderCollectionList();
            CollectionFooterElements.List.scrollTop = 0;
        });
        CollectionFooterElements.Search.addEventListener("keydown", (KeyboardEvent) => {
            if (KeyboardEvent.key === "Escape" && CollectionFooterElements.Search.value) {
                KeyboardEvent.stopPropagation();
                CollectionFooterElements.Search.value = "";
                RenderCollectionList();
            }
        });
        CollectionFooterElements.Footer.addEventListener("click", HandleCollectionFooterClick);
        CollectionFooterElements.Footer.addEventListener("pointerdown", HandleFooterPointerDown);
        CollectionFooterElements.Footer.addEventListener("pointermove", HandleFooterPointerMove);
        CollectionFooterElements.Footer.addEventListener("pointerup", HandleFooterPointerEnd);
        CollectionFooterElements.Footer.addEventListener("pointercancel", HandleFooterPointerEnd);
        // Short screens (a phone held sideways) start with the footer tucked away
        SetCollectionFooterState(window.innerHeight < 500 ? "Minimised" : "Resting");
    }

    /* ------------------------------------------------------------------ */
    /* 11. Start-up + resize                                              */
    /* ------------------------------------------------------------------ */

    function RenderWall(PreserveCameraPosition) {
        // Remember where we are as a fraction of a tile so a resize keeps the same CDs on screen
        const PreviousTileProgressX = CameraState.CurrentX / CameraState.CurrentScale / TilePool.TileWidth;
        const PreviousTileProgressY = CameraState.CurrentY / CameraState.CurrentScale / TilePool.TileHeight;

        CurrentLayoutMetrics = ComputeLayoutMetrics();
        ApplyLayoutSizes(CurrentLayoutMetrics);
        BuildTilePool(CurrentLayoutMetrics);

        if (PreserveCameraPosition) {
            CameraState.TargetX = CameraState.CurrentX = PreviousTileProgressX * TilePool.TileWidth * CameraState.CurrentScale;
            CameraState.TargetY = CameraState.CurrentY = PreviousTileProgressY * TilePool.TileHeight * CameraState.CurrentScale;
            CameraState.VelocityX = CameraState.VelocityY = 0;
        }
        WriteCameraTransform();
    }

    function StartIntroCameraMove() {
        // Open with the start of the collection near the top-left, framed by its neighbours
        const ViewportWidth = window.innerWidth;
        const ViewportHeight = window.innerHeight;
        CameraState.TargetX = TilePool.TileWidth < ViewportWidth ? Math.round((ViewportWidth - TilePool.TileWidth) / 2) : Math.round(CurrentLayoutMetrics.CdSizePx * 0.25);
        CameraState.TargetY = TilePool.TileHeight < ViewportHeight ? Math.round((ViewportHeight - TilePool.TileHeight) / 2) : Math.round(CurrentLayoutMetrics.CdSizePx * 0.2);
        CameraState.CurrentX = CameraState.TargetX + (PrefersReducedMotion ? 0 : Math.min(160, ViewportWidth * 0.12));
        CameraState.CurrentY = CameraState.TargetY;
        WriteCameraTransform();
        requestAnimationFrame(() => {
            ShelfWallElement.classList.add("is-ready");
            RequestCameraFrame();
        });
    }

    let ResizeTimeoutId = null;
    function HandleResize() {
        clearTimeout(ResizeTimeoutId);
        ResizeTimeoutId = setTimeout(() => RenderWall(true), 120);
    }

    function BootListeningWall() {
        ApplyGeneratedTextures();
        ApplyWoodPhotoTexture();
        RenderWall(false);
        StartIntroCameraMove();
        SetUpCollectionFooter();

        ListeningRoomElement.addEventListener("pointerdown", HandlePointerDown);
        ListeningRoomElement.addEventListener("pointermove", HandlePointerMove);
        ListeningRoomElement.addEventListener("pointerup", HandlePointerUp);
        ListeningRoomElement.addEventListener("pointercancel", HandlePointerUp);
        ListeningRoomElement.addEventListener("lostpointercapture", HandlePointerUp);
        ListeningRoomElement.addEventListener("wheel", HandleWheel, { passive: false });
        ListeningRoomElement.addEventListener("focusin", HandleAlbumFocus);
        ListeningRoomElement.addEventListener("contextmenu", (ContextEvent) => ContextEvent.preventDefault());
        ListeningRoomElement.addEventListener("dragstart", (DragEvent) => DragEvent.preventDefault());

        window.addEventListener("keydown", HandleKeyDown);
        window.addEventListener("keydown", TrapAlbumDetailsFocus);
        window.addEventListener("keyup", HandleKeyUp);
        window.addEventListener("blur", () => HeldPanKeys.clear());
        window.addEventListener("resize", HandleResize);
        window.addEventListener("orientationchange", HandleResize);

        AlbumDetailsElements.Popup.addEventListener("click", HandleAlbumDetailsClick);
        AlbumDetailsElements.Popup.addEventListener("keydown", HandleAlbumDetailsKeyDown);

        // Safari pinch gestures zoom the wall rather than the page
        document.addEventListener("gesturestart", HandleGestureStart);
        document.addEventListener("gesturechange", HandleGestureChange);

        if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (TilePool.Tiles[0] && TilePool.Tiles[0].TileElement.offsetWidth !== TilePool.TileWidth) RenderWall(true); });
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", BootListeningWall);
    else BootListeningWall();
})();
