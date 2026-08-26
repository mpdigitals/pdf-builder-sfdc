import {
    executeRichTextCommand,
    getRichTextCommandState
} from 'c/pdfBuilderRichTextCommands';

describe('pdfBuilderRichTextCommands', () => {
    afterEach(() => {
        delete document.execCommand;
        delete document.queryCommandState;
    });

    it('delegates editing commands with the browser contract', () => {
        document.execCommand = jest.fn(() => true);

        expect(executeRichTextCommand('foreColor', '#005fb2')).toBe(true);
        expect(document.execCommand).toHaveBeenCalledWith('foreColor', false, '#005fb2');
    });

    it('delegates command-state reads', () => {
        document.queryCommandState = jest.fn((command) => command === 'bold');

        expect(getRichTextCommandState('bold')).toBe(true);
        expect(getRichTextCommandState('italic')).toBe(false);
    });

    it('degrades safely when the browser does not expose legacy editing commands', () => {
        expect(executeRichTextCommand('bold')).toBe(false);
        expect(getRichTextCommandState('bold')).toBe(false);
    });
});
