/*
Copyright Mathias Bynens <https://mathiasbynens.be/>

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

// TODO handle graphemes
//      http://cldr.unicode.org/
//      https://mathiasbynens.be/notes/javascript-unicode

// Taken and modified from https://github.com/bestiejs/punycode.js
// TODO use `string.normalize("NFC")` ?
// TODO handle BOM ?
export const String_to_Unicode = (string) => {
  const output = [];
  const length = string["length"];

  let counter = 0;

  while (counter < length) {
    const value = string["charCodeAt"](counter++);
    if (value >= 0xD800 && value <= 0xDBFF) {
      if (counter < length) {
        // high surrogate, and there is a next character
        const extra = string["charCodeAt"](counter++);
        if ((extra & 0xFC00) === 0xDC00) { // low surrogate
          output["push"](((value & 0x3FF) << 10) + (extra & 0x3FF) + 0x10000);
        } else {
          // TODO is this correct ?
          throw new Error("Unmatched surrogate");
        }
      } else {
        // TODO is this correct ?
        throw new Error("Unmatched surrogate");
      }
    } else {
      output["push"](value);
    }
  }

  return output;
};

// Taken and modified from https://github.com/bestiejs/punycode.js
export const Unicode_to_String = (list) => {
  const s = [];

  for (let i = 0; i < list["length"]; ++i) {
    const value1 = list[i];

    if (value1 > 0xFFFF) {
      const value2 = value1 - 0x10000;
      s["push"](String["fromCharCode"](value2 >>> 10 & 0x3FF | 0xD800),
                String["fromCharCode"](0xDC00 | value2 & 0x3FF));

    } else {
      s["push"](String["fromCharCode"](value1));
    }
  }

  return s["join"]("");
};
