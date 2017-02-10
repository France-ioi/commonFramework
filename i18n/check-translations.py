#!/usr/bin/env python3
# -*- coding: utf-8 -*-

LANGUAGES = ['en', 'fr', 'de']
NAMESPACE = 'algorea'
PREFILL = True

import json, sys

available_translations = {}
all_keys = set()

# Fetch translations
for lang in LANGUAGES:
    try:
        available_translations[lang] = json.load(open('%s/%s.json' % (lang, NAMESPACE), 'r'))
    except:
        available_translations[lang] = {}
    all_keys = all_keys | set(available_translations[lang].keys())

# Find missing keys
missing_keys = {}
for lang in LANGUAGES:
    missing_keys[lang] = list(all_keys - set(available_translations[lang].keys()))
    missing_keys[lang].sort()

# Make translation JSON
translation_frame = {}
for lang in LANGUAGES:
    if len(missing_keys[lang]) == 0:
        continue
    translation_frame[lang] = []
    for miss in missing_keys[lang]:
        default_trans = None
        other_trans = []
        for other_lang in LANGUAGES:
            if other_lang == lang: continue
            if available_translations[other_lang].get(miss, None) is not None:
                if default_trans is None:
                    default_trans = available_translations[other_lang][miss]
                other_trans.append('(%s) `%s`' % (other_lang, available_translations[other_lang][miss]))
        translation_frame[lang].append([
            miss,
            'Translation in other languages: %s' % ', '.join(other_trans),
            (default_trans if PREFILL else '')])

sys.stdout.buffer.write(json.dumps(translation_frame, sort_keys=True, indent=2, ensure_ascii=False).encode('utf-8'))
