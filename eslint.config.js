const lwcConfig = require('@salesforce/eslint-config-lwc');

module.exports = [
    ...lwcConfig.configs.recommended,
    {
        files: [
            'force-app/main/default/lwc/pdfBuilder/pdfBuilder.js',
            'force-app/main/default/lwc/pdfBuilderBlock/pdfBuilderBlock.js'
        ],
        rules: {
            '@lwc/lwc/no-async-operation': 'off',
            '@lwc/lwc/no-inner-html': 'off',
            'no-await-in-loop': 'off'
        }
    },
    {
        files: [
            'force-app/main/default/lwc/pdfBuilderBlock/__tests__/pdfBuilderBlock.test.js'
        ],
        rules: {
            '@lwc/lwc/no-inner-html': 'off'
        }
    }
];
