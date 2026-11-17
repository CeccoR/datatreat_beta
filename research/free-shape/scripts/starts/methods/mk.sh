#!/bin/sh
# one method file per variant: mk.sh name '{json options}'
cd "$(dirname "$0")"
printf "import { makeMethod } from './ws-core.mjs';\nexport default makeMethod({ name: '%s', ...%s });\n" "$1" "$2" > "v-$1.mjs"
