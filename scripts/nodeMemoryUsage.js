const v8 = require('v8');

/**
 * Logs the current Node.js memory limit and additional V8 memory information.
 * @param {Function} logger - A function to use for logging. Defaults to console.log.
 */
function logNodeMemoryLimit(logger = console.log) {
  try {
    // Get the max heap size in bytes
    const heapStats = v8.getHeapStatistics();
    const maxHeapSize = heapStats.heap_size_limit;

    // Convert to MB for readability
    const maxHeapSizeMB = Math.round(maxHeapSize / (1024 * 1024));

    // Check if NODE_OPTIONS environment variable is set
    const nodeOptions = process.env.NODE_OPTIONS || '';
    const maxOldSpaceSizeMatch = nodeOptions.match(/--max-old-space-size=(\d+)/);

    if (maxOldSpaceSizeMatch) {
      const specifiedLimit = parseInt(maxOldSpaceSizeMatch[1], 10);
      logger(`Node.js memory limit is explicitly set to ${specifiedLimit} MB`);
      logger(`Actual max heap size: ${maxHeapSizeMB} MB`);
    } else {
      logger(`Node.js is using the default memory limit: ${maxHeapSizeMB} MB`);
    }

    // Log additional V8 memory information
    logger('Additional V8 memory info:');
    logger(`  Total heap size: ${Math.round(heapStats.total_heap_size / (1024 * 1024))} MB`);
    logger(`  Used heap size: ${Math.round(heapStats.used_heap_size / (1024 * 1024))} MB`);
    logger(`  Total available size: ${Math.round(heapStats.total_available_size / (1024 * 1024))} MB`);

  } catch (error) {
    logger('Error detecting Node.js memory limit:', error);
  }
}

