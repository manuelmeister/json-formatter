'use strict';

import {createSpan, Templates} from './template';
import * as momoa from '@humanwhocodes/momoa'

let lineNumber;

export function jsonStringToHTML(jsonString, jsonpFunctionName) {
    lineNumber = jsonpFunctionName === null ? 1 : 2;
    return tokenize(jsonString)
        .then((rootKeyValueOrValue) => {
            const gutterWidth = 1 + (lineNumber.toString().length * 0.5) + 'rem';
            const gutter = document.createElement('div');
            gutter.id = 'gutter';
            gutter.style.width = gutterWidth;

            // Make div#formattedJson and append the root keyValueOrValue
            const divFormattedJson = document.createElement('div');
            divFormattedJson.id = 'formattedJson';
            divFormattedJson.style.marginLeft = gutterWidth;
            divFormattedJson.appendChild(rootKeyValueOrValue);

            // Top and tail with JSONP padding if necessary
            if (jsonpFunctionName !== null) {
                divFormattedJson.innerHTML =
                    `<div id="jsonpOpener" line-number="1">${jsonpFunctionName}(</div>
             ${divFormattedJson.innerHTML}
           <div id="jsonpCloser" line-number="${lineNumber}">)</div>`;
            }

            // Return the HTML
            return gutter.outerHTML + divFormattedJson.outerHTML;
        });
}

function tokenize(jsonString) {

    let currentNode = Templates.keyValueOrValue();
    currentNode.classList.add('rootKeyValueOrValue');

    for (const token of momoa.tokenize(jsonString, {})) {
        if (currentNode.tokenType === 'array') {
            const keyValueOrValue = Templates.keyValueOrValue();
            keyValueOrValue.classList.add('arrayElement');
            keyValueOrValue.setAttribute('line-number', lineNumber++);
            currentNode.appendChild(keyValueOrValue);
            currentNode = keyValueOrValue;
        }

        switch (token.type) {
            case 'String':
                if (currentNode.tokenType === 'object') {
                    const keyValueOrValue = Templates.keyValueOrValue();
                    keyValueOrValue.setAttribute('line-number', lineNumber++);
                    keyValueOrValue.classList.add('objectProperty');

                    const keySpan = Templates.key();
                    keySpan.textContent = token.value;
                    keyValueOrValue.appendChild(keySpan);

                    currentNode.appendChild(keyValueOrValue);
                    currentNode = keyValueOrValue;
                } else {
                    const innerStringEl = createSpan();
                    const content = JSON.parse(token.value);
                    let escapedValue = JSON.stringify(content);
                    escapedValue = escapedValue.substring(1, escapedValue.length - 1);

                    // crude but fast - some false positives, but rare, and UX doesn't suffer terribly from them.
                    if (content[0] === 'h' && content.substring(0, 4) === 'http') {
                        const innerStringA = document.createElement('A');
                        innerStringA.href = escapedValue;
                        innerStringA.innerText = escapedValue;
                        innerStringEl.appendChild(innerStringA);
                    } else {
                        innerStringEl.innerText = escapedValue;
                    }

                    const valueElement = Templates.string();
                    valueElement.appendChild(Templates.doubleQuoteText());
                    valueElement.appendChild(innerStringEl);
                    valueElement.appendChild(Templates.doubleQuoteText());
                    currentNode.appendChild(valueElement);
                }
                break;

            case 'Null':
                currentNode.appendChild(Templates.null());
                break;

            case 'Boolean':
                const boolean = Templates.boolean();
                boolean.innerText = token.value;
                currentNode.appendChild(boolean);
                break;

            case 'Number':
                const numberElement = Templates.number();
                numberElement.innerText = token.value;
                currentNode.appendChild(numberElement);
                break;

            case 'Punctuator':
                switch (token.value) {
                    case ',':
                        currentNode.appendChild(Templates.commaText());
                        if (currentNode.classList.contains('keyValueOrValue')) {
                            currentNode = currentNode.parentNode;
                        }
                        break;

                    case ':':
                        currentNode.appendChild(Templates.colonAndSpace());
                        break;

                    case '{':
                        if (!currentNode.classList.contains('objectProperty')) {
                            currentNode.setAttribute('line-number', lineNumber++);
                        }

                        currentNode.appendChild(Templates.expander());
                        currentNode.appendChild(Templates.openingBrace());
                        currentNode.appendChild(Templates.ellipsis());

                        const objectInner = Templates.blockInner();
                        objectInner.tokenType = 'object';

                        currentNode.appendChild(objectInner);
                        currentNode = objectInner;
                        break;

                    case '}':
                        if (currentNode.classList.contains('objectProperty')) {
                            currentNode = currentNode.parentNode;
                        }

                        const objectContentNode = currentNode;
                        currentNode = currentNode.parentNode;

                        const closingBrace = Templates.closingBrace();
                        currentNode.appendChild(closingBrace);

                        if (objectContentNode.childNodes.length) {
                            closingBrace.setAttribute('line-number', lineNumber++);
                        } else {
                            objectContentNode.remove();
                            currentNode.parentNode.querySelector('.expander').remove();
                            currentNode.parentNode.querySelector('.ellipsis').remove();
                        }
                        break;

                    case '[':
                        if (!currentNode.classList.contains('objectProperty')) {
                            currentNode.setAttribute('line-number', lineNumber++);
                        }

                        currentNode.appendChild(Templates.expander());
                        currentNode.appendChild(Templates.openingBracket());
                        currentNode.appendChild(Templates.ellipsis());

                        const arrayInner = Templates.blockInner();
                        arrayInner.tokenType = 'array';

                        currentNode.appendChild(arrayInner);
                        currentNode = arrayInner;
                        break;

                    case ']':
                        if (currentNode.classList.contains('arrayElement')) {
                            currentNode = currentNode.parentNode;
                        }

                        const arrayContentNode = currentNode;
                        currentNode = currentNode.parentNode;

                        const closingBracket = Templates.closingBracket();
                        currentNode.appendChild(closingBracket);

                        if (arrayContentNode.innerText.length) {
                            closingBracket.setAttribute('line-number', lineNumber++);
                        } else {
                            arrayContentNode.remove();
                            currentNode.parentNode.querySelector('.expander').remove();
                            currentNode.parentNode.querySelector('.ellipsis').remove();
                        }
                        break;
                }
        }
    }

    return new Promise((resolve) => {
        resolve(currentNode);
    });
}
