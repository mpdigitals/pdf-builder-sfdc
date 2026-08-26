export const executeRichTextCommand = (command, value = null) => {
    const executor = document.execCommand;
    return typeof executor === 'function'
        ? executor.call(document, command, false, value)
        : false;
};

export const getRichTextCommandState = (command) => {
    const stateReader = document.queryCommandState;
    return typeof stateReader === 'function'
        ? Boolean(stateReader.call(document, command))
        : false;
};
