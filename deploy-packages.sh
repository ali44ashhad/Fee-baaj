#!/bin/bash

node swap-main.js dev

cd /home/jakpro/freebaj/packages/schemas && pnpm run build
cd /home/jakpro/freebaj/packages/types && pnpm run build
cd /home/jakpro/freebaj/packages/lib && pnpm run build
cd /home/jakpro/freebaj/packages/models && pnpm run build