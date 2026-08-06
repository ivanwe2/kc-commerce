/* Payload admin root layout.
 *
 * Adapted from Payload's generated template. Note the divergence from the
 * upstream `with-cloudflare-d1` template, which imports `generatePayloadViewport`
 * — that export does not exist in @payloadcms/next 3.87.1. The template tracks
 * an older pin (3.82.1) and its layout is not forward-compatible.
 */
import config from '@payload-config'
import '@payloadcms/next/css'
import type { ServerFunctionClient } from 'payload'
import { handleServerFunctions, RootLayout } from '@payloadcms/next/layouts'
import React from 'react'

import { importMap } from './admin/importMap.js'
import './custom.css'

type Args = {
  children: React.ReactNode
}

const serverFunction: ServerFunctionClient = async function (args) {
  'use server'
  return handleServerFunctions({
    ...args,
    config,
    importMap,
  })
}

const Layout = ({ children }: Args) => (
  <RootLayout config={config} importMap={importMap} serverFunction={serverFunction}>
    {children}
  </RootLayout>
)

export default Layout
