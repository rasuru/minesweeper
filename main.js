// Functional Utils //

const {
    ifElse,
    add,
    values,
    map,
    reduce,
    reject,
    filter,
    forEach,
    both,
    any,
    addIndex,
    compose,
    repeat,
    splitEvery,
    mergeWith,
    mergeLeft: copyWith,
    flatten,
    lt,
    gte,
    complement: oppositeOf,
    isNil,
    evolve,
    find,
    tap,
    zipWith,
    isEmpty,
    none,
    all,
    when,
    equals,
    length,
    either,
    allPass,
    propEq,
} = R;
const mapWithIndexes = addIndex(map);
const debug = tap(console.log);

// Non-determenistic utils //

const shuffle = (xs) => {
    let counter = xs.length;

    while (counter > 0) {
        let index = Math.floor(Math.random() * counter);

        counter--;

        let temp = xs[counter];
        xs[counter] = xs[index];
        xs[index] = temp;
    }

    return xs;
};

// Domain logic //

const direction = {
    topLeft: { x: -1, y: -1 },
    top: { x: 0, y: -1 },
    topRight: { x: 1, y: -1 },
    left: { x: -1, y: 0 },
    center: { x: 0, y: 0 },
    right: { x: 1, y: 0 },
    bottomLeft: { x: -1, y: 1 },
    bottom: { x: 0, y: 1 },
    bottomRight: { x: 1, y: 1 },
};
const allDirections = values(direction);

const sumCoords = mergeWith(add);
const haveSameCoords = (a) => (b) => a.y === b.y && a.x === b.x;

const isMine = (cell) => cell.isMine;
const isNotMine = oppositeOf(isMine);
const isRevealed = (cell) => cell.isRevealed;
const isSafeCell = both(isNotMine, propEq("nearbyMinesCount", 0));
const isHidden = oppositeOf(isRevealed);
const isBoomed = (cell) => cell.isBoomed;
const isNearMines = (cell) => cell.nearbyMinesCount > 0;

const getCell =
    ({ x, y }) =>
    (board) =>
        (board[y] ?? [])[x];
const getCells = flatten;

const getNearbyCell = (cell) => (board) => (direction) =>
    getCell(sumCoords(cell)(direction))(board);
const getNearbyCells = (cell) => (board) =>
    compose(reject(isNil), map(getNearbyCell(cell)(board)))(allDirections);

const mapCells = (f) =>
    compose(splitEvery(gameOptions.columnCount), map(f), getCells);
const setCells = (cells) =>
    mapCells((cell) => find(haveSameCoords(cell), cells) ?? cell);

const revealCell = copyWith({ isRevealed: true });
const revealNearbyCells = (cell) =>
    compose(map(revealCell), filter(isHidden), getNearbyCells(cell));

const buildSafeCell = (board, cell) => {
    const newNearbyCells = revealNearbyCells(cell)(board);
    const newBoard = setCells(newNearbyCells)(board);

    return compose(
        reduce(buildSafeCell, newBoard),
        filter(isSafeCell)
    )(newNearbyCells);
};
const buildSafeCells = (board) =>
    compose(
        reduce(buildSafeCell, board),
        filter(both(isRevealed, isSafeCell)),
        getCells
    )(board);
const buildMineCell = (board, mine) =>
    setCells(
        compose(
            map(evolve({ nearbyMinesCount: add(1) })),
            getNearbyCells(mine)
        )(board)
    )(board);
const buildMineCells = (board) =>
    compose(reduce(buildMineCell, board), filter(isMine), getCells)(board);
const isBoardBoomed = compose(any(isBoomed), getCells);
const isBoardNotBoomed = oppositeOf(isBoardBoomed);
const isGameWin = compose(all(isMine), filter(isHidden), getCells);
const isFirstTurn = compose(equals(1), length, filter(isRevealed), getCells);
const disarmRevealedCells = mapCells(
    when(isRevealed, copyWith({ isMine: false }))
);
const isGameOver = either(isBoardBoomed, isGameWin);
const isNotGameOver = oppositeOf(isGameOver);
const revealBoard = (board) => {
    const boardIsBoomed = isBoardBoomed(board);

    return mapCells(
        when(
            isHidden,
            copyWith({
                isRevealed: true,
                isRevealedAfterBoom: boardIsBoomed,
            })
        )
    )(board);
};
const boomRevealedMines = mapCells(
    when(both(isRevealed, isMine), copyWith({ isBoomed: true }))
);
const buildCells = compose(
    buildSafeCells,
    buildMineCells,
    when(isFirstTurn, disarmRevealedCells),
    mapCells(copyWith({ nearbyMinesCount: 0 }))
);
const buildBoard = compose(
    when(isGameOver, revealBoard),
    when(isNotGameOver, boomRevealedMines),
    buildCells
);

const setCellCoords = (board) =>
    mapWithIndexes(
        (row, y) => mapWithIndexes((cell, x) => copyWith({ y, x }, cell), row),
        board
    );

// Non-determenistic domain logic //

const generateBoard = (options) => {
    const { rowCount, columnCount, mineCount } = options;
    const totalCellCount = rowCount * columnCount;

    return compose(
        buildBoard,
        setCellCoords,
        splitEvery(columnCount),
        shuffle,
        map((isMine) => ({
            isMine: isMine,
            isRevealed: false,
        }))
    )([
        ...repeat(true, mineCount),
        ...repeat(false, totalCellCount - mineCount),
    ]);
};

// User Interface //

const root = document.documentElement;
const selectHtmlElem = (q) => document.querySelector(q);
const selectHtmlElems = (q) => document.querySelectorAll(q);
const onClick = (f) => (elem) =>
    elem.addEventListener("click", (e) => f(elem, e));
const forEachOnClick = (f) => forEach(onClick(f));
const boardElem = selectHtmlElem(".board");
const cellElems = selectHtmlElems(".cell");
const createCellClassList = (cell) => {
    let result = ["cell"];

    if (cell.isRevealed) {
        result.push("cell_revealed");
        result.push(isMine(cell) ? "cell_mine" : "cell_safe");
    } else {
        result.push("cell_hidden");
    }
    if (cell.isRevealedAfterBoom) {
        result.push("cell_revealed-after-boom");
    }

    return result.join(" ");
};
const createInnerHtml = (cell) => {
    if (isMine(cell) || isHidden(cell)) {
        return "";
    } else {
        const nmc = cell.nearbyMinesCount;
        return `<span>${nmc == 0 ? "" : nmc}</span>`;
    }
};
const renderCell = (elem, cell) => {
    elem.classList = createCellClassList(cell);
    elem.dataset.x = cell.x;
    elem.dataset.y = cell.y;
    elem.innerHTML = createInnerHtml(cell);
};

const backgroundMusic = new Audio("assets/background.ogg");
backgroundMusic.loop = true;
const winMusic = new Audio("assets/win.mp3");
winMusic.loop = true;

const renderBoard = (board) => {
    zipWith(renderCell, cellElems, getCells(board));

    if (isBoardBoomed(board)) {
        new Audio("assets/game-sound-boom.wav").play();
        boardElem.classList.add("board_boomed");
    } else if (isGameWin(board)) {
        winMusic.play();
        backgroundMusic.pause();
        boardElem.classList.add("board_safe");
    } else {
        new Audio("assets/safe.ogg").play();
    }
};

// Execute //

root.style.setProperty("--row-count", gameOptions.rowCount);
root.style.setProperty("--column-count", gameOptions.columnCount);

// Allow autoplay to hear the music
backgroundMusic.play();

let board = generateBoard(gameOptions);
renderBoard(board);
forEachOnClick((cellElem) => {
    const x = +cellElem.dataset.x;
    const y = +cellElem.dataset.y;

    if (isGameOver(board) || board[y][x].isRevealed) return;

    board[y][x].isRevealed = true;
    board = buildBoard(board);
    renderBoard(board);
})(cellElems);
