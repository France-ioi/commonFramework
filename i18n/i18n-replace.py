#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# This is a small and *poorly written* script to quickly replace all
#   label: "value"
# strings in a file (models.js) into
#   label: "translation_key"
# strings for use with an i18n system (such as i18next).
# Check AlgoreaPlatform/i18n/i18n-object.js for an example usage.

import re

INPUT_FILE = 'models.js.old'
OUTPUT_FILE = 'models.js'
TRANSLATION_FILE = 'algorea.json'

tr_regexp = re.compile(r'^\s*"([^"]+)"\s*:\s*"([^"]+)"\s*,\s*$')

translations = []

for l in open(TRANSLATION_FILE, 'r'):
    tr_m = tr_regexp.match(l)
    if tr_m:
        key = tr_m.group(1)
        val = tr_m.group(2)
        translations.append((key, val))

data = open(INPUT_FILE, 'r').read()
newdata = ''

lbl_regexp = re.compile(r'(label\s*:\s*)"([^"]+)"')

nextmatch = lbl_regexp.search(data)
curpos = 0
while nextmatch:
    key, val = translations.pop(0)
    data_val = nextmatch.group(2)
    if data_val != val:
        print("data_val != val: `%s` != `%s`" % (data_val, val))

    newdata += data[curpos:nextmatch.start()]
    newdata += nextmatch.group(1)
    newdata += '"%s"' % key

    curpos = nextmatch.end()
    nextmatch = lbl_regexp.search(data, curpos)

newdata += data[curpos:]

open(OUTPUT_FILE, 'w').write(newdata)
