import { describe, expect, it } from 'vitest'
import {
  isIssuedRemoteExtensionConfig,
  parseRemoteExtensionConfig,
  RemoteExtensionConfigDiagnosticCode,
  RemoteExtensionEnvironmentVariable,
} from './remote-extension-config'

const enabledEnvironment = {
  NIODOWNLOADER_REMOTE_EXTENSION_ENABLED: 'true',
  NIODOWNLOADER_REMOTE_EXTENSION_PUBLIC_URL: 'wss://nio.example/bridge',
  NIODOWNLOADER_PUBLIC_URL: 'https://nio.example/operator',
}

describe('parseRemoteExtensionConfig', () => {
  it('issues ephemeral capabilities and rejects structural copies', () => {
    const parsed = parseRemoteExtensionConfig(enabledEnvironment)

    expect(isIssuedRemoteExtensionConfig(parsed)).toBe(true)
    expect(isIssuedRemoteExtensionConfig({ ...parsed })).toBe(false)
    expect(
      isIssuedRemoteExtensionConfig(JSON.parse(JSON.stringify(parsed)))
    ).toBe(false)
  })

  it.each([
    {},
    { NIODOWNLOADER_REMOTE_EXTENSION_ENABLED: '' },
    { NIODOWNLOADER_REMOTE_EXTENSION_ENABLED: '  ' },
    { NIODOWNLOADER_REMOTE_EXTENSION_ENABLED: 'false' },
    { NIODOWNLOADER_REMOTE_EXTENSION_ENABLED: 'FALSE' },
    { NIODOWNLOADER_REMOTE_EXTENSION_ENABLED: ' 0 ' },
  ])('keeps the surface disabled for %j', (environment) => {
    expect(parseRemoteExtensionConfig(environment)).toEqual({
      status: 'disabled',
    })
  })

  it.each(['true', ' TRUE ', '1', ' 1 '])(
    'accepts the existing strict server boolean spelling %j',
    (enabled) => {
      expect(
        parseRemoteExtensionConfig({
          ...enabledEnvironment,
          NIODOWNLOADER_REMOTE_EXTENSION_ENABLED: enabled,
        }).status
      ).toBe('enabled')
    }
  )

  it('reports an ambiguous enabled flag without throwing', () => {
    expect(
      parseRemoteExtensionConfig({
        ...enabledEnvironment,
        NIODOWNLOADER_REMOTE_EXTENSION_ENABLED: 'yes',
      })
    ).toEqual({
      status: 'invalid',
      diagnostic: {
        variable: RemoteExtensionEnvironmentVariable.Enabled,
        code: RemoteExtensionConfigDiagnosticCode.InvalidEnabledFlag,
      },
    })
  })

  it.each([
    [
      'NIODOWNLOADER_REMOTE_EXTENSION_PUBLIC_URL',
      RemoteExtensionEnvironmentVariable.PublicWebSocketUrl,
    ],
    [
      'NIODOWNLOADER_PUBLIC_URL',
      RemoteExtensionEnvironmentVariable.PublicOperatorUrl,
    ],
  ] as const)('requires %s when enabled', (key, variable) => {
    const environment = { ...enabledEnvironment }
    delete environment[key]

    expect(parseRemoteExtensionConfig(environment)).toEqual({
      status: 'invalid',
      diagnostic: {
        variable,
        code: RemoteExtensionConfigDiagnosticCode.MissingUrl,
      },
    })
  })

  it('canonicalizes default ports, host casing, paths, and IPv6', () => {
    expect(
      parseRemoteExtensionConfig({
        NIODOWNLOADER_REMOTE_EXTENSION_ENABLED: 'true',
        NIODOWNLOADER_REMOTE_EXTENSION_PUBLIC_URL:
          'WSS://[2001:DB8::1]:443/bridge///',
        NIODOWNLOADER_PUBLIC_URL: 'HTTPS://OPERATOR.Example:443/ui///',
      })
    ).toEqual({
      status: 'enabled',
      publicWebSocketBaseUrl: 'wss://[2001:db8::1]/bridge',
      publicWebSocketAuthority: '[2001:db8::1]',
      publicWebSocketBasePath: '/bridge',
      publicOperatorBaseUrl: 'https://operator.example/ui',
      publicOperatorAuthority: 'operator.example',
      publicOperatorBasePath: '/ui',
    })
  })

  it('preserves non-default ports and an empty root prefix', () => {
    expect(
      parseRemoteExtensionConfig({
        NIODOWNLOADER_REMOTE_EXTENSION_ENABLED: '1',
        NIODOWNLOADER_REMOTE_EXTENSION_PUBLIC_URL: 'wss://nio.example:9443/',
        NIODOWNLOADER_PUBLIC_URL: 'https://console.example:8443/',
      })
    ).toEqual({
      status: 'enabled',
      publicWebSocketBaseUrl: 'wss://nio.example:9443',
      publicWebSocketAuthority: 'nio.example:9443',
      publicWebSocketBasePath: '',
      publicOperatorBaseUrl: 'https://console.example:8443',
      publicOperatorAuthority: 'console.example:8443',
      publicOperatorBasePath: '',
    })
  })

  it('accepts and canonicalizes an explicit WS public endpoint', () => {
    expect(
      parseRemoteExtensionConfig({
        NIODOWNLOADER_REMOTE_EXTENSION_ENABLED: 'true',
        NIODOWNLOADER_REMOTE_EXTENSION_PUBLIC_URL:
          'WS://NAS.Local:80/bridge///',
        NIODOWNLOADER_PUBLIC_URL: 'https://console.example/operator',
      })
    ).toEqual({
      status: 'enabled',
      publicWebSocketBaseUrl: 'ws://nas.local/bridge',
      publicWebSocketAuthority: 'nas.local',
      publicWebSocketBasePath: '/bridge',
      publicOperatorBaseUrl: 'https://console.example/operator',
      publicOperatorAuthority: 'console.example',
      publicOperatorBasePath: '/operator',
    })
  })

  it.each(['true', ' TRUE ', '1', ' 1 '])(
    'accepts an HTTP operator URL only with explicit insecure-LAN consent %j',
    (consent) => {
      expect(
        parseRemoteExtensionConfig({
          NIODOWNLOADER_REMOTE_EXTENSION_ENABLED: 'true',
          NIODOWNLOADER_REMOTE_EXTENSION_PUBLIC_URL: 'ws://nas.local:16801',
          NIODOWNLOADER_PUBLIC_URL: 'HTTP://NAS.Local:80/admin///',
          NIODOWNLOADER_ALLOW_INSECURE_OPERATOR_HTTP: consent,
        })
      ).toEqual({
        status: 'enabled',
        publicWebSocketBaseUrl: 'ws://nas.local:16801',
        publicWebSocketAuthority: 'nas.local:16801',
        publicWebSocketBasePath: '',
        publicOperatorBaseUrl: 'http://nas.local/admin',
        publicOperatorAuthority: 'nas.local',
        publicOperatorBasePath: '/admin',
      })
    }
  )

  it.each([undefined, '', 'false', 'FALSE', '0'])(
    'rejects an HTTP operator URL without explicit insecure-LAN consent %j',
    (consent) => {
      expect(
        parseRemoteExtensionConfig({
          NIODOWNLOADER_REMOTE_EXTENSION_ENABLED: 'true',
          NIODOWNLOADER_REMOTE_EXTENSION_PUBLIC_URL: 'ws://nas.local:16801',
          NIODOWNLOADER_PUBLIC_URL: 'http://nas.local:8080',
          ...(consent === undefined
            ? {}
            : { NIODOWNLOADER_ALLOW_INSECURE_OPERATOR_HTTP: consent }),
        })
      ).toEqual({
        status: 'invalid',
        diagnostic: {
          variable:
            RemoteExtensionEnvironmentVariable.AllowInsecureOperatorHttp,
          code: RemoteExtensionConfigDiagnosticCode.InsecureOperatorHttpConsentRequired,
        },
      })
    }
  )

  it('rejects an ambiguous insecure-HTTP consent flag', () => {
    expect(
      parseRemoteExtensionConfig({
        NIODOWNLOADER_REMOTE_EXTENSION_ENABLED: 'true',
        NIODOWNLOADER_REMOTE_EXTENSION_PUBLIC_URL: 'ws://nas.local:16801',
        NIODOWNLOADER_PUBLIC_URL: 'http://nas.local:8080',
        NIODOWNLOADER_ALLOW_INSECURE_OPERATOR_HTTP: 'yes',
      })
    ).toEqual({
      status: 'invalid',
      diagnostic: {
        variable: RemoteExtensionEnvironmentVariable.AllowInsecureOperatorHttp,
        code: RemoteExtensionConfigDiagnosticCode.InvalidInsecureOperatorHttpFlag,
      },
    })
  })

  it('does not require insecure-LAN consent for HTTPS', () => {
    expect(
      parseRemoteExtensionConfig({
        ...enabledEnvironment,
        NIODOWNLOADER_ALLOW_INSECURE_OPERATOR_HTTP: 'false',
      }).status
    ).toBe('enabled')
  })

  it.each([
    ['https://nio.example/bridge', 'https://nio.example'],
    ['wss://nio.example/bridge', 'wss://nio.example'],
  ])(
    'rejects protocol substitution (%s, %s)',
    (publicWebSocketUrl, publicOperatorUrl) => {
      const result = parseRemoteExtensionConfig({
        NIODOWNLOADER_REMOTE_EXTENSION_ENABLED: 'true',
        NIODOWNLOADER_REMOTE_EXTENSION_PUBLIC_URL: publicWebSocketUrl,
        NIODOWNLOADER_PUBLIC_URL: publicOperatorUrl,
      })
      expect(result.status).toBe('invalid')
      if (result.status === 'invalid') {
        expect(result.diagnostic.code).toBe(
          RemoteExtensionConfigDiagnosticCode.UnsupportedProtocol
        )
      }
    }
  )

  it.each([
    ['wss://user:secret@nio.example/bridge', 'userinfo'],
    ['wss://@nio.example/bridge', 'empty userinfo'],
    ['wss://nio.example/bridge?token=secret', 'query'],
    ['wss://nio.example/bridge?', 'empty query'],
    ['wss://nio.example/bridge#fragment', 'fragment'],
    ['wss://nio.example/bridge#', 'empty fragment'],
    ['wss:\\nio.example\\bridge', 'backslash'],
    ['wss://nio.example/bridge\nnext', 'ASCII control'],
    ['wss://nio.example/bridge%2Fhidden', 'encoded slash'],
    ['wss://nio.example/bridge%5chidden', 'encoded backslash'],
    ['wss://nio.example/bridge%252fhidden', 'double-encoded slash'],
    ['wss://nio.example/bridge%25%32%66hidden', 'split encoded slash'],
    ['wss://nio.example/bridge%25%35%63hidden', 'split encoded backslash'],
    ['wss://nio.example/bridge%zz', 'invalid percent encoding'],
    [' wss://nio.example/bridge', 'leading whitespace'],
    ['wss://nio.example/bridge ', 'trailing whitespace'],
    ['wss://nio.example/bridge path', 'embedded whitespace'],
    ['wss://nio.example/bridge\u00a0path', 'Unicode whitespace'],
    ['wss://nio.example/bridge\u0085path', 'Unicode White_Space'],
    ['not a URL', 'invalid URL'],
  ])('rejects %s (%s)', (publicWebSocketUrl) => {
    expect(
      parseRemoteExtensionConfig({
        ...enabledEnvironment,
        NIODOWNLOADER_REMOTE_EXTENSION_PUBLIC_URL: publicWebSocketUrl,
      }).status
    ).toBe('invalid')
  })

  it.each([
    'https://user:secret@nio.example/operator',
    'https://@nio.example/operator',
    'https://nio.example/operator?token=secret',
    'https://nio.example/operator#fragment',
    'https:\\nio.example\\operator',
    'https://nio.example/operator\u0000tail',
    'https://nio.example/operator%2ftail',
    'https://nio.example/operator%255ctail',
    ' https://nio.example/operator',
    'https://nio.example/operator ',
    'https://nio.example/operator\u2003path',
  ])('applies the same strict policy to the operator URL %j', (publicUrl) => {
    expect(
      parseRemoteExtensionConfig({
        ...enabledEnvironment,
        NIODOWNLOADER_PUBLIC_URL: publicUrl,
      }).status
    ).toBe('invalid')
  })

  it('rejects overlong inputs without echoing them in diagnostics', () => {
    const secretPath = `wss://nio.example/${'secret'.repeat(700)}`
    const result = parseRemoteExtensionConfig({
      ...enabledEnvironment,
      NIODOWNLOADER_REMOTE_EXTENSION_PUBLIC_URL: secretPath,
    })

    expect(result).toEqual({
      status: 'invalid',
      diagnostic: {
        variable: RemoteExtensionEnvironmentVariable.PublicWebSocketUrl,
        code: RemoteExtensionConfigDiagnosticCode.UrlTooLong,
      },
    })
    expect(JSON.stringify(result)).not.toContain('secret')
  })

  it('rejects a canonical URL that expands beyond the length limit', () => {
    const result = parseRemoteExtensionConfig({
      ...enabledEnvironment,
      NIODOWNLOADER_REMOTE_EXTENSION_PUBLIC_URL: `wss://nio.example/${'é'.repeat(1000)}`,
    })

    expect(result).toEqual({
      status: 'invalid',
      diagnostic: {
        variable: RemoteExtensionEnvironmentVariable.PublicWebSocketUrl,
        code: RemoteExtensionConfigDiagnosticCode.UrlTooLong,
      },
    })
  })

  it('is byte-stable when canonical output is parsed again', () => {
    const first = parseRemoteExtensionConfig({
      NIODOWNLOADER_REMOTE_EXTENSION_ENABLED: 'true',
      NIODOWNLOADER_REMOTE_EXTENSION_PUBLIC_URL:
        'WSS://B\u00dcCHER.example:443/bridge/ressources///',
      NIODOWNLOADER_PUBLIC_URL:
        'HTTPS://B\u00dcCHER.example:443/operator/seiten///',
    })
    expect(first.status).toBe('enabled')
    if (first.status !== 'enabled') return

    expect(
      parseRemoteExtensionConfig({
        NIODOWNLOADER_REMOTE_EXTENSION_ENABLED: 'true',
        NIODOWNLOADER_REMOTE_EXTENSION_PUBLIC_URL: first.publicWebSocketBaseUrl,
        NIODOWNLOADER_PUBLIC_URL: first.publicOperatorBaseUrl,
      })
    ).toEqual(first)
  })

  it('never throws for malformed runtime input or hostile property access', () => {
    const wrongType = {
      ...enabledEnvironment,
      NIODOWNLOADER_PUBLIC_URL: 42,
    } as unknown as Record<string, string | undefined>
    expect(() => parseRemoteExtensionConfig(wrongType)).not.toThrow()
    expect(parseRemoteExtensionConfig(wrongType)).toEqual({
      status: 'invalid',
      diagnostic: {
        variable: 'configuration',
        code: RemoteExtensionConfigDiagnosticCode.InvalidEnvironment,
      },
    })

    const hostile = Object.defineProperty(
      {},
      'NIODOWNLOADER_REMOTE_EXTENSION_ENABLED',
      {
        get() {
          throw new Error('operator-secret')
        },
      }
    ) as Record<string, string | undefined>
    expect(() => parseRemoteExtensionConfig(hostile)).not.toThrow()
    expect(JSON.stringify(parseRemoteExtensionConfig(hostile))).not.toContain(
      'operator-secret'
    )
  })

  it('never consumes or returns a legacy token', () => {
    expect(
      parseRemoteExtensionConfig({
        NIODOWNLOADER_REMOTE_EXTENSION_TOKEN: 'legacy-super-secret',
      })
    ).toEqual({ status: 'disabled' })

    expect(
      parseRemoteExtensionConfig({
        NIODOWNLOADER_REMOTE_EXTENSION_ENABLED: 'true',
        NIODOWNLOADER_REMOTE_EXTENSION_TOKEN: 'legacy-super-secret',
      })
    ).toEqual({
      status: 'invalid',
      diagnostic: {
        variable: RemoteExtensionEnvironmentVariable.PublicWebSocketUrl,
        code: RemoteExtensionConfigDiagnosticCode.MissingUrl,
      },
    })

    const result = parseRemoteExtensionConfig({
      ...enabledEnvironment,
      NIODOWNLOADER_REMOTE_EXTENSION_TOKEN: 'legacy-super-secret',
    })

    expect(result.status).toBe('enabled')
    expect(JSON.stringify(result)).not.toContain('legacy-super-secret')
    expect(result).not.toHaveProperty('token')
  })

  it('does not infer public authority from forwarded headers', () => {
    const missingExplicitAuthority = parseRemoteExtensionConfig({
      NIODOWNLOADER_REMOTE_EXTENSION_ENABLED: 'true',
      NIODOWNLOADER_PUBLIC_URL: 'https://operator.example',
      X_FORWARDED_HOST: 'attacker.example',
      X_FORWARDED_PROTO: 'wss',
    })
    expect(missingExplicitAuthority).toEqual({
      status: 'invalid',
      diagnostic: {
        variable: RemoteExtensionEnvironmentVariable.PublicWebSocketUrl,
        code: RemoteExtensionConfigDiagnosticCode.MissingUrl,
      },
    })

    const configured = parseRemoteExtensionConfig({
      ...enabledEnvironment,
      X_FORWARDED_HOST: 'attacker.example',
      X_FORWARDED_PROTO: 'ws',
    })
    expect(configured).toMatchObject({
      status: 'enabled',
      publicWebSocketAuthority: 'nio.example',
    })
  })
})
