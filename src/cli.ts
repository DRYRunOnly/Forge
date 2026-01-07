#!/usr/bin/env node

import { Command } from 'commander';
import { ForgeCore } from './core/forge-core';
import { loadConfig } from './utils/config';
import { setupLogger } from './utils/logger';
import chalk from 'chalk';

const program = new Command();

async function main() {
  const config = await loadConfig();
  // We'll set up verbose logging later based on CLI args
  const forge = new ForgeCore(config);

  program
    .name('forge')
    .description('Forge - A universal package manager that forges packages across ecosystems')
    .version('0.1.0');

  // Cache command
  program
    .command('cache')
    .description('Cache management')
    .argument('<action>', 'Action: clear, info')
    .argument('[format]', 'Format: node, python, maven (optional - clears all if not specified)')
    .action(async (action: string, format?: string) => {
      try {
        switch (action) {
          case 'clear':
            const result = await forge.clearCache(format);
            if (result.cleared) {
              console.log(chalk.green(result.message));
            } else {
              console.log(chalk.yellow(result.message));
            }
            break;
            
          case 'info':
            const cacheInfo = await forge.getCacheInfo(format);
            if (format) {
              // Show specific format info
              console.log(chalk.blue(`${format.toUpperCase()} Cache Information:`));
              console.log(`  Directory: ${cacheInfo.directory}`);
              console.log(`  Size: ${cacheInfo.size}`);
              console.log(`  Files: ${cacheInfo.fileCount}`);
              console.log(chalk.blue('Configuration:'));
              console.log(`  Max Size: ${cacheInfo.config.maxSize}`);
              console.log(`  TTL: ${cacheInfo.config.ttl}ms`);
            } else {
              // Show all formats info
              console.log(chalk.blue('Cache Information:'));
              console.log(`  Total Directory: ${cacheInfo.totalDirectory}`);
              console.log(chalk.blue('Configuration:'));
              console.log(`  Max Size: ${cacheInfo.config.maxSize}`);
              console.log(`  TTL: ${cacheInfo.config.ttl}ms`);
              
              if (cacheInfo.formats.length > 0) {
                console.log(chalk.blue('\nFormat Breakdown:'));
                cacheInfo.formats.forEach((fmt: any) => {
                  console.log(`  ${fmt.format.toUpperCase()}: ${fmt.size} (${fmt.fileCount} files)`);
                });
              } else {
                console.log(chalk.yellow('\nNo cached files found.'));
              }
            }
            break;
            
          default:
            console.error(chalk.red(`Unknown cache action: ${action}`));
            console.log('Available actions: clear, info');
            console.log('Available formats: node, python, maven (optional)');
            console.log('Examples:');
            console.log('  forge cache clear node    # Clear only node cache');
            console.log('  forge cache clear         # Clear all caches');
            console.log('  forge cache info node     # Show node cache info');
            console.log('  forge cache info          # Show all cache info');
            process.exit(1);
        }
      } catch (error) {
        console.error(chalk.red(`Cache ${action} failed: ${error}`));
        process.exit(1);
      }
    });

  // Config command
  program
    .command('config')
    .description('Manage configuration')
    .argument('<action>', 'Action to perform')
    .argument('[key-or-priority]', 'Config key (get/set) or priority list (set-priority)')
    .argument('[value]', 'Configuration value (for set action only)')
    .addHelpText('after', `
Actions:
  get <key>              Get configuration value
  list                   List all configuration
  set <key> <value>      Set configuration value
  set-priority <list>    Set plugin detection priority (comma-separated)

Examples:
  forge config get pluginPriority
  forge config list
  forge config set cache.maxSize 2GB
  forge config set-priority "python,node,maven"`)
    .action(async (action: string, key?: string, value?: string) => {
      try {
        switch (action) {
          case 'get':
            if (!key) {
              console.error(chalk.red('Key is required for get action'));
              process.exit(1);
            }
            const val = await forge.getConfig(key);
            if (Array.isArray(val)) {
              console.log(val.join(', '));
            } else {
              console.log(val);
            }
            break;
            
          case 'set':
            if (!key || !value) {
              console.error(chalk.red('Key and value are required for set action'));
              process.exit(1);
            }
            await forge.setConfig(key, value);
            console.log(chalk.green(`Configuration ${key} set to ${value}`));
            break;
            
          case 'set-priority':
            if (!key) {
              console.error(chalk.red('Plugin priority is required for set-priority action'));
              console.error(chalk.yellow('Example: forge config set-priority "python,node,maven"'));
              process.exit(1);
            }
            const priority = key.split(',').map(p => p.trim());
            await forge.setPluginPriority(priority);
            console.log(chalk.green(`Plugin detection priority set to: ${priority.join(', ')}`));
            break;
            
          case 'list':
            const config = await forge.listConfig();
            console.log(JSON.stringify(config, null, 2));
            break;
            
          default:
            console.error(chalk.red(`Unknown action: ${action}`));
            console.log('');
            console.log('Available actions:');
            console.log('  get <key>              Get configuration value');
            console.log('  list                   List all configuration');
            console.log('  set <key> <value>      Set configuration value');
            console.log('  set-priority <list>    Set plugin detection priority');
            console.log('');
            console.log('Examples:');
            console.log('  forge config get pluginPriority');
            console.log('  forge config set cache.maxSize 2GB');
            console.log('  forge config set-priority "python,node,maven"');
            console.log('  forge config list');
            process.exit(1);
        }
      } catch (error) {
        console.error(chalk.red(`Config operation failed: ${error}`));
        process.exit(1);
      }
    });

  // Info command
  program
    .command('info')
    .description('Get information about a package')
    .argument('<package>', 'Package name')
    .option('-v, --verbose', 'Enable verbose logging')
    .action(async (packageName: string, options) => {
      try {
        // Setup logger with verbose flag
        setupLogger(options.verbose);
        
        const info = await forge.getPackageInfo(packageName);
        
        console.log(chalk.bold(info.name));
        if (info.description) {
          console.log(info.description);
        }
        console.log('');
        console.log(`Latest version: ${chalk.green(info.latest)}`);
        console.log(`Available versions: ${info.versions.slice(-10).join(', ')}`);
        if (info.homepage) {
          console.log(`Homepage: ${info.homepage}`);
        }
        if (info.repository) {
          console.log(`Repository: ${info.repository}`);
        }
        if (info.license) {
          console.log(`License: ${info.license}`);
        }
      } catch (error) {
        console.error(chalk.red(`Failed to get package info: ${error}`));
        process.exit(1);
      }
    });

  // Install command
  program
    .command('install')
    .alias('i')
    .description('Install packages')
    .argument('[packages...]', 'Packages to install')
    .option('--dry-run', 'Show what would be installed without actually installing')
    .option('-f, --format <format>', 'Force specific format (node, python) instead of auto-detection')
    .option('--registry <url>', 'Override default registry for this command')
    .option('-D, --save-dev', 'Save to devDependencies')
    .option('-v, --verbose', 'Enable verbose logging')
    .action(async (packages: string[], options) => {
      try {
        // Setup logger with verbose flag
        setupLogger(options.verbose);
        
        const result = await forge.install({
          packages,
          saveDev: options.saveDev,
          dryRun: options.dryRun,
          verbose: options.verbose,
          registry: options.registry,
          format: options.format
        });
        
        if (result.errors.length > 0) {
          console.error(chalk.red('Installation completed with errors:'));
          result.errors.forEach(error => {
            console.error(chalk.red(`  ${error.package}: ${error.error}`));
          });
        } else if (
          result.installed.length === 0 &&
          result.updated.length === 0 &&
          result.removed.length === 0
        ) {
          console.log(chalk.green('Nothing to install, all packages already present.'));
        } else {
          console.log(chalk.green('Installation completed successfully!'));
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.log(chalk.red(`Installation failed: ${errorMessage}`));
        process.exit(1);
      }
    });

  // List command
  program
    .command('list')
    .alias('ls')
    .description('List installed packages')
    .option('--depth <depth>', 'Depth to show dependencies', '0')
    .option('-v, --verbose', 'Enable verbose logging')
    .action(async (options) => {
      try {
        // Setup logger with verbose flag
        setupLogger(options.verbose);
        
        const packages = await forge.listInstalled(parseInt(options.depth));
        
        if (packages.length === 0) {
          console.log(chalk.yellow('No packages installed.'));
          return;
        }

        console.log(chalk.bold('Installed packages:'));
        packages.forEach(pkg => {
          console.log(`${pkg.name}@${pkg.version}`);
        });
      } catch (error) {
        console.error(chalk.red(`Failed to list packages: ${error}`));
        process.exit(1);
      }
    });

  // Login command
  program
    .command('login')
    .description('Login to a registry')
    .option('--registry <url>', 'Registry URL')
    .option('--token <token>', 'Authentication token')
    .action(async (options) => {
      try {
        const result = await forge.login({
          registry: options.registry,
          token: options.token
        });
        console.log(chalk.green('Login successful!'));
      } catch (error) {
        console.error(chalk.red(`Login failed: ${error}`));
        process.exit(1);
      }
    });

  // Logout command
  program
    .command('logout')
    .description('Logout from registry')
    .option('--all', 'Logout from all registries')
    .option('--registry <url>', 'Registry URL')
    .action(async (options) => {
      try {
        await forge.logout({
          registry: options.registry,
          all: options.all
        });
        console.log(chalk.green('Logout successful!'));
      } catch (error) {
        console.error(chalk.red(`Logout failed: ${error}`));
        process.exit(1);
      }
    });

  // Registry management command
  program
    .command('registry')
    .description('Manage registries')
    .argument('<action>', 'Action: list, add, remove, set-default')
    .argument('[name]', 'Registry name')
    .argument('[url]', 'Registry URL')
    .option('--scope <scope>', 'Package format scope (node, python, maven)')
    .option('--token <token>', 'Authentication token')
    .action(async (action: string, name?: string, url?: string, options?: any) => {
      try {
        const result = await forge.manageRegistry(action, {
          name,
          url,
          token: options?.token,
          scope: options?.scope
        });
        
        if (action === 'list') {
          console.log(chalk.blue('Configured registries:'));
          result.forEach((registry: any) => {
            console.log(`  ${registry.name}: ${registry.url} (${registry.scope})`);
          });
        } else {
          console.log(chalk.green(`Registry ${action} successful!`));
        }
      } catch (error) {
        console.error(chalk.red(`Registry ${action} failed: ${error}`));
        process.exit(1);
      }
    });

  // Remove command
  program
    .command('remove')
    .alias('rm')
    .description('Remove packages')
    .argument('<packages...>', 'Packages to remove')
    .option('--dry-run', 'Show what would be removed without actually removing')
    .option('-f, --format <format>', 'Force specific format (node, python) instead of auto-detection')
    .option('-v, --verbose', 'Enable verbose logging')
    .action(async (packages: string[], options) => {
      try {
        const result = await forge.remove({
          packages,
          dryRun: options.dryRun,
          verbose: options.verbose,
          format: options.format
        });
        
        if (result.errors.length > 0) {
          console.error(chalk.red('Removal completed with errors:'));
          result.errors.forEach(error => {
            console.error(chalk.red(`  ${error.package}: ${error.error}`));
          });
        } else {
          console.log(chalk.green('Packages removed successfully!'));
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.log(chalk.red(`Remove failed: ${errorMessage}`));
        process.exit(1);
      }
    });

  // Search command
  program
    .command('search')
    .description('Search for packages')
    .argument('<query>', 'Search query')
    .option('-f, --format <format>', 'Limit search to specific format (node, python, maven)')
    .option('-v, --verbose', 'Enable verbose logging')
    .action(async (query: string, options) => {
      try {
        // Setup logger with verbose flag
        setupLogger(options.verbose);
        
        const results = await forge.search(query, options.format);
        
        if (results.length === 0) {
          console.log(chalk.yellow('No packages found.'));
          return;
        }

        console.log(chalk.bold(`Found ${results.length} packages:`));
        results.forEach(pkg => {
          console.log(`${chalk.green(pkg.name)}@${pkg.version}`);
          if (pkg.description) {
            console.log(`  ${chalk.gray(pkg.description)}`);
          }
          console.log('');
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.log(chalk.red(`Search failed: ${errorMessage}`));
        process.exit(1);
      }
    });

  // Update command
  program
    .command('update')
    .description('Update packages')
    .argument('[packages...]', 'Packages to update (updates all if none specified)')
    .option('--dry-run', 'Show what would be updated without actually updating')
    .option('-f, --format <format>', 'Force specific format (node, python) instead of auto-detection')
    .option('-v, --verbose', 'Enable verbose logging')
    .action(async (packages: string[], options) => {
      try {
        // Setup logger with verbose flag
        setupLogger(options.verbose);
        
        const result = await forge.update({
          packages,
          dryRun: options.dryRun,
          verbose: options.verbose,
          format: options.format
        });
        
        if (result.updated.length > 0) {
          console.log(chalk.green('Updated packages:'));
          result.updated.forEach(pkg => {
            console.log(`  ${pkg.name}@${pkg.version}`);
          });
        } else {
          console.log(chalk.yellow('All packages are up to date.'));
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.log(chalk.red(`Update failed: ${errorMessage}`));
        process.exit(1);
      }
    });

  await program.parseAsync(process.argv);
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error(chalk.red('Uncaught exception:'), error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  const errorMessage = reason instanceof Error ? reason.message : String(reason);
  console.log(chalk.red(`Unhandled rejection: ${errorMessage}`));
  process.exit(1);
});

main().catch(error => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.log(chalk.red(`Failed to start Forge: ${errorMessage}`));
  process.exit(1);
});