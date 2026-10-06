const APP_NAME = 'IT Asset Management & Request Job System';
const APP_BUILD_VERSION = '2026-10-06-knowledge-folder-rename-delete-v7';
const SESSION_HOURS = 12;
const APP_TIME_ZONE = 'Asia/Bangkok';
// Keep this below the browser request timeout so users receive a clear retry message.
const WRITE_LOCK_TIMEOUT_MS = 20000;
const SESSION_CACHE_TTL_SECONDS = 300;
const SIDEBAR_ALERTS_CACHE_TTL_SECONDS = 300;
// Writes advance a module version immediately, so a longer read cache prevents
// repeated full-sheet reads while preserving fresh data after app actions.
const MODULE_RECORDS_CACHE_TTL_SECONDS = 180;
const ASSET_HISTORY_CACHE_TTL_SECONDS = 300;
const KNOWLEDGE_PREVIEW_MAX_BYTES = 10 * 1024 * 1024;
const MODULE_RECORDS_CACHE_MAX_LENGTH = 90000;
const SESSION_RETENTION_DAYS = 7;
const AUDIT_LOG_ARCHIVE_RETENTION_DAYS = 365;
var EXECUTION_SPREADSHEET_CACHE_ = null;
var EXECUTION_SHEET_CACHE_ = {};
var EXECUTION_SCHEMA_READY_ = {};
var EXECUTION_DIRTY_MODULES_ = {};
var EXECUTION_DASHBOARD_ROWS_ = null;

const SHEET_SCHEMAS = {
  Users: ['UserID', 'Username', 'FullName', 'Department', 'Role', 'Email', 'Status', 'PasswordHash', 'PasswordSalt', 'LastLogin', 'CreatedAt', 'UpdatedAt'],
  Assets: ['AssetID', 'FixedAssetNo', 'AssetName', 'DateOfDepreciation', 'PONo', 'Quantity', 'LifeTime', 'AmountBaht', 'User', 'Location', 'Remark', 'CreatedAt', 'UpdatedAt', 'Group', 'SerialNumber', 'CPU', 'Storage', 'RAM'],
  AssetAssignmentHistory: ['HistoryID', 'AssetID', 'FixedAssetNo', 'AssetName', 'PreviousUser', 'NewUser', 'PreviousLocation', 'NewLocation', 'ChangeType', 'ChangedBy', 'ChangedAt', 'Remark'],
  ComputerBorrowings: ['BorrowingID', 'AssetID', 'FixedAssetNo', 'AssetName', 'ModelDescription', 'CPU', 'Storage', 'RAM', 'SerialNumber', 'Accessories', 'SoftwareInfo', 'HandoverBy', 'Borrower', 'BorrowerDepartment', 'BorrowedAt', 'BorrowerSignatureFileId', 'BorrowerSignatureUrl', 'ReturnedBy', 'ReturnReceivedBy', 'ReturnedAt', 'ReturnSignatureFileId', 'ReturnSignatureUrl', 'ReturnRemark', 'Status', 'CreatedAt', 'UpdatedAt'],
  Tickets: ['TicketID', 'RequestDate', 'Requester', 'Department', 'Contact', 'Location', 'RequestedService', 'Category', 'InventoryItemID', 'RequestedQuantity', 'RequestSignatureFileId', 'RequestSignatureUrl', 'Priority', 'Subject', 'Description', 'AttachmentFileId', 'AttachmentUrl', 'AttachmentFileName', 'AssignedTo', 'ServiceMethod', 'WorkStartedAt', 'WorkCompletedAt', 'Status', 'DueDate', 'ResolvedDate', 'ResolutionNote', 'ResolutionSignatureFileId', 'ResolutionSignatureUrl', 'ResolutionPhotoFileId', 'ResolutionPhotoUrl', 'Remark', 'ClientRequestID', 'CreatedAt', 'UpdatedAt'],
  AccessRequests: ['RequestID', 'RequestDate', 'Requester', 'Department', 'RequestType', 'TargetUser', 'SystemName', 'Reason', 'Status', 'ApprovedBy', 'Remark', 'CreatedAt', 'UpdatedAt'],
  StockItems: ['ItemID', 'ItemName', 'Category', 'Quantity', 'MinimumStock', 'Location', 'Unit', 'StockStatus', 'LastUpdated', 'CreatedAt', 'UpdatedAt', 'Description'],
  StockMovements: ['MovementID', 'MovementDate', 'ItemID', 'MovementType', 'Quantity', 'ReferenceNo', 'PerformedBy', 'Remark', 'CreatedAt', 'UpdatedAt'],
  Licenses: ['LicenseID', 'SoftwareName', 'LicenseType', 'TotalQty', 'UsedQty', 'ExpiryDate', 'Vendor', 'AssignedUser', 'Status', 'Remark', 'CreatedAt', 'UpdatedAt'],
  MaintenanceAgreements: ['AgreementID', 'AgreementName', 'Category', 'CoveredAsset', 'Vendor', 'ContractNo', 'StartDate', 'EndDate', 'RenewalNoticeDays', 'AmountBaht', 'Owner', 'Status', 'DocumentURL', 'Remark', 'CreatedAt', 'UpdatedAt', 'RenewalOfAgreementID'],
  Documents: ['DocumentID', 'DocumentType', 'Title', 'OwnerDepartment', 'ReviewDate', 'LinkURL', 'Status', 'Remark', 'CreatedAt', 'UpdatedAt', 'Category', 'Keywords', 'DriveFileId', 'FileName', 'MimeType', 'FileSize', 'Version', 'UploadedBy', 'UploadedAt', 'LastUpdatedBy'],
  AuditLogs: ['LogID', 'Timestamp', 'Action', 'Module', 'RecordID', 'ActorUserID', 'ActorName', 'ActorRole', 'Detail'],
  AuditLogsArchive: ['LogID', 'Timestamp', 'Action', 'Module', 'RecordID', 'ActorUserID', 'ActorName', 'ActorRole', 'Detail'],
  MasterData: ['GroupName', 'ItemCode', 'ItemLabel', 'IsActive', 'UpdatedAt'],
  Sessions: ['SessionID', 'UserID', 'Username', 'Role', 'Token', 'ExpiresAt', 'IsActive', 'CreatedAt', 'LastSeenAt']
};

const MODULES = {
  users: { sheet: 'Users', idField: 'UserID', roles: ['Admin', 'User'], permissions: { create: ['Admin'], edit: ['Admin'], delete: ['Admin'] }, redact: ['PasswordHash', 'PasswordSalt'] },
  assets: { sheet: 'Assets', idField: 'AssetID', roles: ['Admin', 'User'], permissions: { create: ['Admin'], edit: ['Admin'], delete: ['Admin'] } },
  tickets: { sheet: 'Tickets', idField: 'TicketID', roles: ['Admin'], permissions: { create: ['Admin'], edit: ['Admin'], delete: ['Admin'] } },
  accessRequests: { sheet: 'AccessRequests', idField: 'RequestID', roles: ['Admin', 'User'], permissions: { create: ['Admin', 'User'], edit: ['Admin'], delete: ['Admin'] } },
  stockItems: { sheet: 'StockItems', idField: 'ItemID', roles: ['Admin', 'User'], permissions: { create: ['Admin'], edit: ['Admin'], delete: ['Admin'] } },
  stockMovements: { sheet: 'StockMovements', idField: 'MovementID', roles: ['Admin', 'User'], permissions: { create: ['Admin'], edit: ['Admin'], delete: ['Admin'] } },
  licenses: { sheet: 'Licenses', idField: 'LicenseID', roles: ['Admin', 'User'], permissions: { create: ['Admin'], edit: ['Admin'], delete: ['Admin'] } },
  maintenanceAgreements: { sheet: 'MaintenanceAgreements', idField: 'AgreementID', roles: ['Admin', 'User'], permissions: { create: ['Admin'], edit: ['Admin'], delete: ['Admin'] } },
  documents: { sheet: 'Documents', idField: 'DocumentID', roles: ['Admin', 'User'], permissions: { create: ['Admin'], edit: ['Admin'], delete: ['Admin'] } },
  auditLogs: { sheet: 'AuditLogs', idField: 'LogID', roles: ['Admin', 'User'], permissions: { create: [], edit: [], delete: [] } }
};

const MASTER_DATA_SEED = {
  Departments: ['IT', 'Production', 'Quality', 'Finance', 'HR', 'Warehouse'],
  TicketCategories: ['Software Installation', 'Hardware Request', 'Printer Request', 'Network Request', 'Email Request', 'ERP / D365 Request', 'New User Request', 'Resignation User Request', 'Other'],
  AccessRequestTypes: ['Create AD User', 'Disable AD User', 'Password Reset', 'Shared Folder Permission', 'Email Group', 'ERP / D365 Permission', 'VPN Permission'],
  // Folders are managed by users. Do not recreate renamed or deleted defaults.
  KnowledgeCategories: []
};

function getSpreadsheet_() {
  if (EXECUTION_SPREADSHEET_CACHE_) {
    return EXECUTION_SPREADSHEET_CACHE_;
  }
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (spreadsheetId) {
    EXECUTION_SPREADSHEET_CACHE_ = SpreadsheetApp.openById(spreadsheetId);
  } else {
    EXECUTION_SPREADSHEET_CACHE_ = SpreadsheetApp.getActiveSpreadsheet();
  }
  return EXECUTION_SPREADSHEET_CACHE_;
}

function getNowString_() {
  return Utilities.formatDate(new Date(), APP_TIME_ZONE, 'yyyy-MM-dd HH:mm:ss');
}

function getDashboardCacheKey_(sessionUser) {
  var version = PropertiesService.getScriptProperties().getProperty('DASHBOARD_CACHE_VERSION') || '0';
  var scope = normalizeRole_(sessionUser.Role) === 'admin'
    ? 'admin' : String(sessionUser.UserID || sessionUser.Username || 'anonymous');
  return 'dashboard:v5:' + version + ':' + scope;
}

function invalidateDashboardCache_() {
  var properties = PropertiesService.getScriptProperties();
  var currentVersion = Number(properties.getProperty('DASHBOARD_CACHE_VERSION') || 0);
  properties.setProperty('DASHBOARD_CACHE_VERSION', String(currentVersion + 1));
}

function invalidateModuleRecords_(sheetName) {
  // Sessions are always looked up by token and are never served from the
  // module-record cache, so changing a session must not spend a Properties
  // service call invalidating a cache that does not exist.
  if (sheetName === 'Sessions') {
    return;
  }
  EXECUTION_DIRTY_MODULES_[sheetName] = true;
  PropertiesService.getScriptProperties().setProperty('MODULE_VERSION_' + sheetName, Utilities.getUuid());
}

function getModuleRecordsCacheKey_(sheetName) {
  var version = PropertiesService.getScriptProperties().getProperty('MODULE_VERSION_' + sheetName) || '0';
  return 'module-records:v2:' + version + ':' + String(sheetName || '');
}

function encodeModuleRecordsCache_(records) {
  try {
    var json = JSON.stringify(records || []);
    var compressed = Utilities.gzip(Utilities.newBlob(json, 'application/json'));
    var encoded = Utilities.base64Encode(compressed.getBytes());
    return encoded.length <= MODULE_RECORDS_CACHE_MAX_LENGTH ? encoded : '';
  } catch (error) {
    return '';
  }
}

function decodeModuleRecordsCache_(encoded) {
  try {
    var compressed = Utilities.newBlob(Utilities.base64Decode(String(encoded || '')));
    return JSON.parse(Utilities.ungzip(compressed).getDataAsString());
  } catch (error) {
    return null;
  }
}

function getCachedModuleRecords_(sheetName) {
  var cache = CacheService.getScriptCache();
  var cacheKey = getModuleRecordsCacheKey_(sheetName);
  var cached = cache.get(cacheKey);
  if (cached) {
    var decoded = decodeModuleRecordsCache_(cached);
    if (decoded) {
      return decoded;
    }
  }

  var records = rowsToObjects_(sheetName);
  var encoded = encodeModuleRecordsCache_(records);
  if (encoded) {
    cache.put(cacheKey, encoded, MODULE_RECORDS_CACHE_TTL_SECONDS);
  }
  return records;
}

function getCachedTicketWorkspaceRecords_() {
  var cache = CacheService.getScriptCache();
  var cacheKey = getModuleRecordsCacheKey_('Tickets:workspace');
  var cached = cache.get(cacheKey);
  if (cached) {
    var decoded = decodeModuleRecordsCache_(cached);
    if (decoded) return decoded;
  }

  var sheet = getSheetByName_('Tickets') || ensureSheet_('Tickets', SHEET_SCHEMAS.Tickets);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  // The queue only needs fields shown in its table.  Do not read long notes,
  // file URLs, or signature metadata until an individual ticket is opened.
  var primary = sheet.getRange(1, 1, lastRow, 14).getValues();
  var progress = sheet.getRange(1, 19, lastRow, 7).getValues();
  var metadata = sheet.getRange(1, 33, lastRow, 2).getValues();
  var primaryHeaders = SHEET_SCHEMAS.Tickets.slice(0, 14);
  var progressHeaders = SHEET_SCHEMAS.Tickets.slice(18, 25);
  var metadataHeaders = SHEET_SCHEMAS.Tickets.slice(32, 34);
  var records = [];

  for (var rowIndex = 1; rowIndex < lastRow; rowIndex += 1) {
    if (!primary[rowIndex].some(function(cell) { return cell !== ''; })) continue;
    var record = {};
    primaryHeaders.forEach(function(header, index) { record[header] = primary[rowIndex][index]; });
    progressHeaders.forEach(function(header, index) { record[header] = progress[rowIndex][index]; });
    metadataHeaders.forEach(function(header, index) { record[header] = metadata[rowIndex][index]; });
    records.push(record);
  }

  var encoded = encodeModuleRecordsCache_(records);
  if (encoded) cache.put(cacheKey, encoded, MODULE_RECORDS_CACHE_TTL_SECONDS);
  return records;
}

function getSessionCacheKey_(token) {
  return 'session:v1:' + String(token || '');
}

function cacheValidatedSession_(token, sessionRecord, user) {
  if (!token || !sessionRecord || !user) {
    return;
  }
  CacheService.getScriptCache().put(getSessionCacheKey_(token), JSON.stringify({
    session: {
      Token: sessionRecord.Token,
      ExpiresAt: sessionRecord.ExpiresAt,
      IsActive: sessionRecord.IsActive,
      LastSeenAt: sessionRecord.LastSeenAt || ''
    },
    user: sanitizeRecord_('users', user)
  }), SESSION_CACHE_TTL_SECONDS);
}

function removeCachedSession_(token) {
  if (token) {
    CacheService.getScriptCache().remove(getSessionCacheKey_(token));
  }
}

function withWriteLock_(callback) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(WRITE_LOCK_TIMEOUT_MS);
  } catch (error) {
    throw new Error('Another update is in progress. Please try again in a moment.');
  }

  try {
    var result = callback();
    SpreadsheetApp.flush();
    return result;
  } finally {
    lock.releaseLock();
  }
}

function makeJsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function logApiTiming_(action, startedAt) {
  console.log(JSON.stringify({
    event: 'api_timing',
    action: action || 'unknown',
    durationMs: new Date().getTime() - startedAt
  }));
}

function parseRequestBody_(e) {
  const params = {};
  if (e && e.parameter) {
    Object.keys(e.parameter).forEach(function(key) {
      params[key] = e.parameter[key];
    });
  }

  if (e && e.postData && e.postData.contents) {
    try {
      const json = JSON.parse(e.postData.contents);
      Object.keys(json).forEach(function(key) {
        params[key] = json[key];
      });
    } catch (error) {
    }
  }

  return params;
}

function parsePossibleJson_(value) {
  if (typeof value !== 'string') {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch (error) {
    return value;
  }
}

function getSheetByName_(sheetName) {
  if (Object.prototype.hasOwnProperty.call(EXECUTION_SHEET_CACHE_, sheetName)) {
    return EXECUTION_SHEET_CACHE_[sheetName];
  }
  EXECUTION_SHEET_CACHE_[sheetName] = getSpreadsheet_().getSheetByName(sheetName);
  return EXECUTION_SHEET_CACHE_[sheetName];
}

function ensureSheet_(sheetName, headers) {
  if (EXECUTION_SCHEMA_READY_[sheetName]) return getSheetByName_(sheetName);
  const spreadsheet = getSpreadsheet_();
  let sheet = getSheetByName_(sheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
    EXECUTION_SHEET_CACHE_[sheetName] = sheet;
  }

  const currentHeaders = sheet.getRange(1, 1, 1, headers.length).getValues()[0];

  headers.forEach(function(header, index) {
    if (currentHeaders[index] !== header) {
      sheet.getRange(1, index + 1).setValue(header);
    }
  });

  if (sheet.getFrozenRows() !== 1) {
    sheet.setFrozenRows(1);
  }
  EXECUTION_SCHEMA_READY_[sheetName] = true;
  return sheet;
}

function rowsToObjects_(sheetName) {
  return rowsToObjectsWithMeta_(sheetName, false);
}

function rowsToObjectsWithMeta_(sheetName, includeMeta) {
  const schemaHeaders = SHEET_SCHEMAS[sheetName];
  // Schema is provisioned by initializeSystem/bootstrapSchema. Read paths must not
  // repeatedly validate headers or freeze rows because that adds Sheet RPCs per API call.
  const sheet = getSheetByName_(sheetName) || (schemaHeaders && schemaHeaders.length
    ? ensureSheet_(sheetName, schemaHeaders)
    : null);
  if (!sheet) {
    return [];
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return [];
  }

  const columnCount = schemaHeaders && schemaHeaders.length ? schemaHeaders.length : sheet.getLastColumn();
  const values = sheet.getRange(1, 1, lastRow, columnCount).getValues();

  const headers = values[0];
  return values.slice(1).map(function(row, rowIndex) {
    if (!row.some(function(cell) { return cell !== ''; })) {
      return null;
    }

    const record = {};
    headers.forEach(function(header, index) {
      record[header] = row[index];
    });
    if (includeMeta) {
      record.__rowNumber = rowIndex + 2;
    }
    return record;
  }).filter(function(record) {
    return !!record;
  });
}

function writeObjects_(sheetName, records) {
  const headers = SHEET_SCHEMAS[sheetName];
  const sheet = ensureSheet_(sheetName, headers);
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).clearContent();
  }

  if (!records.length) {
    invalidateModuleRecords_(sheetName);
    return;
  }

  const values = records.map(function(record) {
    return headers.map(function(header) {
      return record[header] != null ? record[header] : '';
    });
  });

  sheet.getRange(2, 1, values.length, headers.length).setValues(values);
  invalidateModuleRecords_(sheetName);
}

function appendObject_(sheetName, record) {
  const headers = SHEET_SCHEMAS[sheetName];
  const sheet = ensureSheet_(sheetName, headers);
  const row = headers.map(function(header) {
    return record[header] != null ? record[header] : '';
  });
  sheet.getRange(sheet.getLastRow() + 1, 1, 1, headers.length).setValues([row]);
  invalidateModuleRecords_(sheetName);
}

function appendObjects_(sheetName, records) {
  if (!records || !records.length) {
    return;
  }

  const headers = SHEET_SCHEMAS[sheetName];
  const sheet = ensureSheet_(sheetName, headers);
  const values = records.map(function(record) {
    return headers.map(function(header) {
      return record[header] != null ? record[header] : '';
    });
  });
  sheet.getRange(sheet.getLastRow() + 1, 1, values.length, headers.length).setValues(values);
  invalidateModuleRecords_(sheetName);
}

function writeObjectToRow_(sheetName, rowNumber, record) {
  const headers = SHEET_SCHEMAS[sheetName];
  const sheet = ensureSheet_(sheetName, headers);
  const row = headers.map(function(header) {
    return record[header] != null ? record[header] : '';
  });
  sheet.getRange(rowNumber, 1, 1, headers.length).setValues([row]);
  invalidateModuleRecords_(sheetName);
}

function readObjectFromRow_(sheetName, rowNumber) {
  var headers = SHEET_SCHEMAS[sheetName];
  var sheet = ensureSheet_(sheetName, headers);
  var values = sheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0];
  var record = {};
  headers.forEach(function(header, index) {
    record[header] = values[index];
  });
  record.__rowNumber = rowNumber;
  return record;
}

function sanitizeRecord_(moduleKey, record) {
  const module = MODULES[moduleKey];
  if (!module || !module.redact) {
    return record;
  }
  const copy = {};
  Object.keys(record).forEach(function(key) {
    if (module.redact.indexOf(key) === -1) {
      copy[key] = record[key];
    }
  });
  return copy;
}

function generateId_(prefix, sheetName) {
  const count = rowsToObjects_(sheetName).length + 1;
  return prefix + '-' + ('000' + count).slice(-3);
}

function findRowNumberByField_(sheetName, fieldName, expectedValue) {
  var headers = SHEET_SCHEMAS[sheetName];
  var sheet = ensureSheet_(sheetName, headers);
  var columnIndex = headers.indexOf(fieldName);
  if (columnIndex === -1 || sheet.getLastRow() < 2) {
    return 0;
  }

  var values = sheet.getRange(2, columnIndex + 1, sheet.getLastRow() - 1, 1).getValues();
  for (var index = 0; index < values.length; index += 1) {
    if (String(values[index][0] || '').trim() === String(expectedValue || '').trim()) {
      return index + 2;
    }
  }
  return 0;
}

function findRecordByFieldFast_(sheetName, fieldName, expectedValue, matchCase) {
  var headers = SHEET_SCHEMAS[sheetName];
  var sheet = ensureSheet_(sheetName, headers);
  var columnIndex = headers.indexOf(fieldName) + 1;
  if (columnIndex < 1 || sheet.getLastRow() < 2) {
    return null;
  }

  var match = sheet.getRange(2, columnIndex, sheet.getLastRow() - 1, 1)
    .createTextFinder(String(expectedValue || '').trim())
    .matchCase(matchCase !== false)
    .matchEntireCell(true)
    .findNext();
  return match ? readObjectFromRow_(sheetName, match.getRow()) : null;
}

function findUserByUsername_(username) {
  return findRecordByFieldFast_('Users', 'Username', username, false);
}

function findUserById_(userId) {
  return findRecordByFieldFast_('Users', 'UserID', userId, true);
}

function findSessionByToken_(token) {
  return findRecordByFieldFast_('Sessions', 'Token', token, true);
}

function generateSequentialIdFromColumn_(prefix, sheetName, idField) {
  var headers = SHEET_SCHEMAS[sheetName];
  var sheet = ensureSheet_(sheetName, headers);
  var columnIndex = headers.indexOf(idField);
  var highestNumber = 0;

  if (columnIndex !== -1 && sheet.getLastRow() >= 2) {
    var values = sheet.getRange(2, columnIndex + 1, sheet.getLastRow() - 1, 1).getValues();
    var pattern = new RegExp('^' + prefix + '-(\\d+)$', 'i');
    values.forEach(function(row) {
      var match = String(row[0] || '').trim().match(pattern);
      if (match) {
        highestNumber = Math.max(highestNumber, Number(match[1]));
      }
    });
  }

  return prefix + '-' + ('000' + (highestNumber + 1)).slice(-3);
}

function generateMonthlyTicketId_() {
  var yearMonth = Utilities.formatDate(new Date(), APP_TIME_ZONE, 'yyyyMM');
  var prefix = 'TCK-' + yearMonth;
  var propertyKey = 'TICKET_SEQUENCE_' + yearMonth;
  var properties = PropertiesService.getScriptProperties();
  var storedSequence = properties.getProperty(propertyKey);
  var highestNumber = storedSequence == null ? NaN : Number(storedSequence);

  // Only the first ticket for a month scans legacy Sheet rows. Every later
  // ticket uses the persistent counter while its caller holds the write lock.
  if (!isFinite(highestNumber) || highestNumber < 0) {
    var sheet = ensureSheet_('Tickets', SHEET_SCHEMAS.Tickets);
    var ticketIdColumn = SHEET_SCHEMAS.Tickets.indexOf('TicketID') + 1;
    highestNumber = 0;
    if (ticketIdColumn > 0 && sheet.getLastRow() >= 2) {
      var values = sheet.getRange(2, ticketIdColumn, sheet.getLastRow() - 1, 1).getValues();
      var pattern = new RegExp('^' + prefix + '-(\\d+)$', 'i');
      values.forEach(function(row) {
        var match = String(row[0] || '').trim().match(pattern);
        if (match) highestNumber = Math.max(highestNumber, Number(match[1]));
      });
    }
  }

  var nextNumber = highestNumber + 1;
  properties.setProperty(propertyKey, String(nextNumber));
  return prefix + '-' + ('000' + nextNumber).slice(-3);
}

function getIdPrefix_(moduleKey, module) {
  const prefixMap = {
    users: 'USR',
    assets: 'ITA',
    tickets: 'TCK',
    accessRequests: 'ACC',
    stockItems: 'STK',
    stockMovements: 'MOV',
    licenses: 'LIC',
    maintenanceAgreements: 'MA',
    documents: 'DOC',
    auditLogs: 'LOG'
  };
  return prefixMap[moduleKey] || String(module.idField || 'REC').replace(/[^A-Z]/g, '').slice(0, 3) || 'REC';
}

function buildSequentialId_(prefix, index) {
  return prefix + '-' + ('000' + index).slice(-3);
}

function createSalt_() {
  return Utilities.getUuid().replace(/-/g, '').slice(0, 16);
}

function hashPassword_(password, salt) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password + salt);
  return bytes.map(function(byte) {
    const value = (byte < 0 ? byte + 256 : byte).toString(16);
    return value.length === 1 ? '0' + value : value;
  }).join('');
}

function isTruthyCell_(value) {
  return value === true || value === 'TRUE' || value === 'true' || value === 1 || value === '1';
}

function toDateValue_(value) {
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === 'number') {
    return new Date(value);
  }
  if (typeof value === 'string' && value) {
    const normalized = value.replace(' ', 'T');
    const parsed = new Date(normalized);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return null;
}

function isPresentOrFutureDateValue_(value) {
  const dateValue = toDateValue_(value);
  return dateValue ? dateValue.getTime() >= new Date().getTime() : false;
}

function shouldTouchSession_(lastSeenAt) {
  var lastSeenDate = toDateValue_(lastSeenAt);
  if (!lastSeenDate) {
    return true;
  }
  return (new Date().getTime() - lastSeenDate.getTime()) >= (5 * 60 * 1000);
}

function getAssetAgeMonthsFromDateValue_(value) {
  const dateValue = toDateValue_(value);
  if (!dateValue) {
    return -1;
  }

  const today = new Date();
  let years = today.getFullYear() - dateValue.getFullYear();
  let months = today.getMonth() - dateValue.getMonth();

  if (today.getDate() < dateValue.getDate()) {
    months -= 1;
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  return Math.max(0, (years * 12) + months);
}

function getLifeTimeMonths_(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) {
    return -1;
  }

  const yearMatch = raw.match(/(\d+(?:\.\d+)?)\s*(year|years|yr|yrs|y)/);
  if (yearMatch) {
    return Math.round(Number(yearMatch[1]) * 12);
  }

  const monthMatch = raw.match(/(\d+(?:\.\d+)?)\s*(month|months|mo|mos|m)/);
  if (monthMatch) {
    return Math.round(Number(monthMatch[1]));
  }

  const numericOnly = Number(raw.replace(/[^0-9.]/g, ''));
  if (isFinite(numericOnly) && numericOnly > 0) {
    return Math.round(numericOnly * 12);
  }

  return -1;
}

function normalizeRole_(role) {
  return String(role || '').trim().toLowerCase();
}

function normalizeDateFieldValue_(value) {
  if (value == null || value === '') {
    return '';
  }

  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, APP_TIME_ZONE, 'yyyy-MM-dd');
  }

  if (typeof value === 'number') {
    var excelEpoch = new Date(Date.UTC(1899, 11, 30));
    excelEpoch.setUTCDate(excelEpoch.getUTCDate() + value);
    return Utilities.formatDate(excelEpoch, APP_TIME_ZONE, 'yyyy-MM-dd');
  }

  var text = String(value).trim();
  if (!text) {
    return '';
  }

  var isoMatch = text.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (isoMatch) {
    return isoMatch[1] + '-' + ('0' + isoMatch[2]).slice(-2) + '-' + ('0' + isoMatch[3]).slice(-2);
  }

  var localMatch = text.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
  if (localMatch) {
    return localMatch[3] + '-' + ('0' + localMatch[2]).slice(-2) + '-' + ('0' + localMatch[1]).slice(-2);
  }

  var parsed = new Date(text.replace(' ', 'T'));
  if (!isNaN(parsed.getTime())) {
    return Utilities.formatDate(parsed, APP_TIME_ZONE, 'yyyy-MM-dd');
  }

  return text;
}

function normalizeDateFieldsForRecord_(record) {
  var dateFields = [
    'DateOfDepreciation',
    'RequestDate',
    'DueDate',
    'ResolvedDate',
    'MovementDate',
    'ExpiryDate',
    'ReviewDate'
  ];
  var dateTimeFields = ['CreatedAt', 'UpdatedAt', 'LastLogin', 'LastUpdated', 'Timestamp', 'ExpiresAt', 'LastSeenAt'];

  dateFields.forEach(function(fieldName) {
    if (record[fieldName] != null && record[fieldName] !== '') {
      record[fieldName] = normalizeDateFieldValue_(record[fieldName]);
    }
  });
  dateTimeFields.forEach(function(fieldName) {
    if (record[fieldName] != null && record[fieldName] !== '') {
      record[fieldName] = normalizeDateTimeFieldValue_(record[fieldName]);
    }
  });

  return record;
}

function normalizeDateTimeFieldValue_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, APP_TIME_ZONE, 'yyyy-MM-dd HH:mm:ss');
  }
  var text = String(value || '').trim();
  if (!text) return '';
  var match = text.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (match) {
    return match[1] + '-' + ('0' + match[2]).slice(-2) + '-' + ('0' + match[3]).slice(-2) + ' ' +
      ('0' + (match[4] || '0')).slice(-2) + ':' + (match[5] || '00') + ':' + (match[6] || '00');
  }
  var parsed = new Date(text.replace(' ', 'T'));
  return isNaN(parsed.getTime()) ? text : Utilities.formatDate(parsed, APP_TIME_ZONE, 'yyyy-MM-dd HH:mm:ss');
}

function bootstrapSchema() {
  Object.keys(SHEET_SCHEMAS).forEach(function(sheetName) {
    ensureSheet_(sheetName, SHEET_SCHEMAS[sheetName]);
  });
  seedMasterData_();
  return { success: true, message: 'Schema ready' };
}

function seedMasterData_() {
  const sheetName = 'MasterData';
  const existing = rowsToObjects_(sheetName);
  const rows = [];
  const existingKeys = {};
  existing.forEach(function(item) {
    existingKeys[String(item.GroupName || '').trim().toLowerCase() + '|' + String(item.ItemLabel || '').trim().toLowerCase()] = true;
  });

  Object.keys(MASTER_DATA_SEED).forEach(function(groupName) {
    MASTER_DATA_SEED[groupName].forEach(function(itemLabel, index) {
      var key = groupName.toLowerCase() + '|' + String(itemLabel).toLowerCase();
      if (existingKeys[key]) {
        return;
      }
      rows.push({
        GroupName: groupName,
        ItemCode: groupName.slice(0, 3).toUpperCase() + '-' + ('000' + (index + 1)).slice(-3),
        ItemLabel: itemLabel,
        IsActive: 'TRUE',
        UpdatedAt: getNowString_()
      });
    });
  });
  appendObjects_(sheetName, rows);
}

function login_(params) {
  const username = String(params.username || '').trim();
  const password = String(params.password || '').trim();

  if (!username || !password) {
    throw new Error('Username and password are required');
  }

  const user = findUserByUsername_(username);

  if (!user || user.Status !== 'Active') {
    throw new Error('Invalid username or password');
  }

  const passwordHash = hashPassword_(password, user.PasswordSalt);
  if (passwordHash !== user.PasswordHash) {
    throw new Error('Invalid username or password');
  }

  // Credential lookup and hashing happen before the global write lock. This keeps
  // concurrent users from waiting on read-only login work.
  return withWriteLock_(function() {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_HOURS * 60 * 60 * 1000);
    const sessionRecord = {
      SessionID: 'SES-' + Utilities.getUuid(),
      UserID: user.UserID,
      Username: user.Username,
      Role: user.Role,
      Token: Utilities.getUuid(),
      ExpiresAt: Utilities.formatDate(expiresAt, APP_TIME_ZONE, 'yyyy-MM-dd HH:mm:ss'),
      IsActive: 'TRUE',
      CreatedAt: getNowString_(),
      LastSeenAt: getNowString_()
    };
    appendObject_('Sessions', sessionRecord);

    cacheValidatedSession_(sessionRecord.Token, sessionRecord, user);
    return {
      token: sessionRecord.Token,
      expiresAt: sessionRecord.ExpiresAt,
      user: sanitizeRecord_('users', user)
    };
  });
}

// This deliberately runs after the browser has received its session. Updating
// a profile row and writing an audit row are useful, but must not make a user
// wait to enter the system or keep other logins behind the write lock.
function recordLoginActivity_(sessionUser) {
  if (!sessionUser || !sessionUser.UserID) {
    return { recorded: false };
  }

  return withWriteLock_(function() {
    var user = findUserById_(sessionUser.UserID);
    if (!user) {
      return { recorded: false };
    }

    user.LastLogin = getNowString_();
    user.UpdatedAt = getNowString_();
    writeObjectToRow_('Users', user.__rowNumber, user);
    writeAuditLog_({
      action: 'LOGIN',
      module: 'auth',
      recordId: user.UserID,
      actorUserId: user.UserID,
      actorName: user.FullName,
      actorRole: user.Role,
      detail: 'User logged in'
    });
    return { recorded: true };
  });
}

function register_(params) {
  const fullName = String(params.fullName || '').trim();
  const username = String(params.username || '').trim();
  const department = String(params.department || '').trim();
  const email = String(params.email || '').trim().toLowerCase();
  const password = String(params.password || '').trim();

  if (!fullName || !username || !department || !password) {
    throw new Error('Registration data is incomplete');
  }

  if (!/^[A-Za-z0-9._-]{4,30}$/.test(username)) {
    throw new Error('Username format is invalid');
  }

  const users = rowsToObjects_('Users');
  const usernameExists = users.some(function(item) {
    return String(item.Username || '').toLowerCase() === username.toLowerCase();
  });
  if (usernameExists) {
    throw new Error('Username already exists');
  }

  if (email) {
    const emailExists = users.some(function(item) {
      return String(item.Email || '').toLowerCase() === email;
    });
    if (emailExists) {
      throw new Error('Email already exists');
    }
  }

  const now = getNowString_();
  const userId = generateId_('USR', 'Users');
  const salt = createSalt_();
  const record = {
    UserID: userId,
    Username: username,
    FullName: fullName,
    Department: department,
    Role: 'User',
    Email: email,
    Status: 'Active',
    PasswordHash: hashPassword_(password, salt),
    PasswordSalt: salt,
    LastLogin: '',
    CreatedAt: now,
    UpdatedAt: now
  };

  users.push(record);
  writeObjects_('Users', users);
  writeAuditLog_({
    action: 'REGISTER',
    module: 'auth',
    recordId: userId,
    actorUserId: userId,
    actorName: fullName,
    actorRole: 'User',
    detail: 'User self-registered account'
  });

  return {
    user: sanitizeRecord_('users', record)
  };
}

function logout_(token) {
  const sessionRecord = findSessionByToken_(token);

  if (sessionRecord && isTruthyCell_(sessionRecord.IsActive)) {
    const user = findUserById_(sessionRecord.UserID);
    sessionRecord.IsActive = 'FALSE';
    sessionRecord.LastSeenAt = getNowString_();
    writeObjectToRow_('Sessions', sessionRecord.__rowNumber, sessionRecord);
    if (user) {
      writeAuditLog_({
        action: 'LOGOUT',
        module: 'auth',
        recordId: user.UserID,
        actorUserId: user.UserID,
        actorName: user.FullName,
        actorRole: user.Role,
        detail: 'User logged out'
      });
    }
  }

  removeCachedSession_(token);

  return { loggedOut: true };
}

function validateSession_(token) {
  if (!token) {
    throw new Error('Session token is required');
  }

  var cache = CacheService.getScriptCache();
  var cachedValue = cache.get(getSessionCacheKey_(token));
  if (cachedValue) {
    try {
      var cached = JSON.parse(cachedValue);
      if (cached.session && cached.user && isTruthyCell_(cached.session.IsActive) && isPresentOrFutureDateValue_(cached.session.ExpiresAt)) {
        return { session: cached.session, user: cached.user };
      }
    } catch (error) {
      // Fall through to Sheets when a cache entry cannot be parsed.
    }
  }

  const sessionRecord = findSessionByToken_(token);

  if (!sessionRecord || !isTruthyCell_(sessionRecord.IsActive) || !isPresentOrFutureDateValue_(sessionRecord.ExpiresAt)) {
    throw new Error('Session expired or invalid');
  }

  const user = findUserById_(sessionRecord.UserID);

  if (!user || user.Status !== 'Active') {
    throw new Error('User not found or inactive');
  }

  if (shouldTouchSession_(sessionRecord.LastSeenAt)) {
    sessionRecord.LastSeenAt = getNowString_();
    writeObjectToRow_('Sessions', sessionRecord.__rowNumber, sessionRecord);
  }

  cacheValidatedSession_(token, sessionRecord, user);

  return {
    session: sessionRecord,
    user: sanitizeRecord_('users', user)
  };
}

function writeAuditLog_(entry) {
  appendObject_('AuditLogs', {
    LogID: 'LOG-' + Utilities.getUuid(),
    Timestamp: getNowString_(),
    Action: entry.action,
    Module: entry.module,
    RecordID: entry.recordId || '',
    ActorUserID: entry.actorUserId || '',
    ActorName: entry.actorName || '',
    ActorRole: entry.actorRole || '',
    Detail: entry.detail || ''
  });
}

function writeAuditLogsBatch_(entries) {
  if (!entries || !entries.length) {
    return;
  }

  const rows = entries.map(function(entry) {
    return {
      LogID: 'LOG-' + Utilities.getUuid(),
      Timestamp: getNowString_(),
      Action: entry.action,
      Module: entry.module,
      RecordID: entry.recordId || '',
      ActorUserID: entry.actorUserId || '',
      ActorName: entry.actorName || '',
      ActorRole: entry.actorRole || '',
      Detail: entry.detail || ''
    };
  });

  appendObjects_('AuditLogs', rows);
}

// Run daily via setupPerformanceMaintenance to keep session token searches small.
function cleanupExpiredSessions() {
  return withWriteLock_(function() {
    var cutoff = new Date(new Date().getTime() - SESSION_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    var sessions = rowsToObjects_('Sessions');
    var retained = sessions.filter(function(session) {
      var expiresAt = toDateValue_(session.ExpiresAt);
      return !expiresAt || expiresAt.getTime() >= cutoff.getTime();
    });
    var removedCount = sessions.length - retained.length;
    if (removedCount) {
      writeObjects_('Sessions', retained);
    }
    return { removedSessions: removedCount, retainedSessions: retained.length };
  });
}

// This is intentionally manual so historical logs are never removed without approval.
function archiveOldAuditLogs() {
  return withWriteLock_(function() {
    var cutoff = new Date(new Date().getTime() - AUDIT_LOG_ARCHIVE_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    var auditLogs = rowsToObjects_('AuditLogs');
    var archive = [];
    var retained = [];
    auditLogs.forEach(function(entry) {
      var timestamp = toDateValue_(entry.Timestamp);
      if (timestamp && timestamp.getTime() < cutoff.getTime()) {
        archive.push(entry);
      } else {
        retained.push(entry);
      }
    });
    if (archive.length) {
      appendObjects_('AuditLogsArchive', archive);
      writeObjects_('AuditLogs', retained);
    }
    return { archivedAuditLogs: archive.length, retainedAuditLogs: retained.length };
  });
}

// Run once manually from Apps Script to install the daily session cleanup trigger.
function setupPerformanceMaintenance() {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'cleanupExpiredSessions') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  ScriptApp.newTrigger('cleanupExpiredSessions').timeBased().everyDays(1).atHour(2).create();
  return { message: 'Daily session cleanup trigger created for approximately 02:00.' };
}

function assertModuleAccess_(moduleKey, role, actionType) {
  const module = MODULES[moduleKey];
  if (!module) {
    throw new Error('Unknown module');
  }

  const normalizedRole = normalizeRole_(role);
  const allowedModuleRoles = (module.roles || []).map(function(item) {
    return normalizeRole_(item);
  });

  if (allowedModuleRoles.indexOf(normalizedRole) === -1) {
    throw new Error('Access denied');
  }

  if (actionType) {
    const allowed = (module.permissions && module.permissions[actionType]) || [];
    const normalizedAllowed = allowed.map(function(item) {
      return normalizeRole_(item);
    });
    if (normalizedAllowed.length && normalizedAllowed.indexOf(normalizedRole) === -1) {
      throw new Error('Permission denied');
    }
  }

  return module;
}

function listRecords_(moduleKey, sessionUser) {
  const module = assertModuleAccess_(moduleKey, sessionUser.Role);
  // Read records by their actual sheet headers.  Older Ticket sheets can have
  // columns in a different order from the current schema.
  var records = getCachedModuleRecords_(module.sheet);
  if (moduleKey === 'assets') {
    records = hydrateAssetSpecifications_(records);
  }
  return applyRoleScope_(moduleKey, records, sessionUser).map(function(record) {
    if (moduleKey === 'maintenanceAgreements') {
      record.Status = getMaintenanceAgreementStatus_(record);
    }
    return sanitizeRecord_(moduleKey, record);
  });
}

function searchAssets_(query, sessionUser) {
  assertModuleAccess_('assets', sessionUser.Role);
  var searchText = String(query || '').trim().toLowerCase();
  if (!searchText) {
    throw new Error('Enter a computer name, asset tag, serial number, Asset ID, or location');
  }
  // Read from the short-lived module cache and return only matching records.
  // This avoids transferring the complete Asset sheet to the browser per search.
  return applyRoleScope_('assets', hydrateAssetSpecifications_(getCachedModuleRecords_('Assets')), sessionUser)
    .filter(function(asset) {
      return ['AssetName', 'FixedAssetNo', 'SerialNumber', 'AssetID', 'Location'].some(function(field) {
        return String(asset[field] || '').toLowerCase().indexOf(searchText) !== -1;
      });
    })
    .slice(0, 20)
    .map(function(asset) { return sanitizeRecord_('assets', asset); });
}

function normalizeAssetNameForSpecification_(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function hydrateAssetSpecifications_(records) {
  var specificationsByAssetName = {};
  (records || []).forEach(function(record) {
    var name = normalizeAssetNameForSpecification_(record.AssetName);
    if (!name) return;
    if (!specificationsByAssetName[name]) {
      specificationsByAssetName[name] = { CPU: '', Storage: '', RAM: '' };
    }
    ['CPU', 'Storage', 'RAM'].forEach(function(field) {
      if (!specificationsByAssetName[name][field] && String(record[field] || '').trim()) {
        specificationsByAssetName[name][field] = String(record[field]).trim();
      }
    });
  });
  return (records || []).map(function(record) {
    var copy = {};
    Object.keys(record).forEach(function(key) { copy[key] = record[key]; });
    var specification = specificationsByAssetName[normalizeAssetNameForSpecification_(copy.AssetName)];
    if (specification) {
      ['CPU', 'Storage', 'RAM'].forEach(function(field) {
        if (!String(copy[field] || '').trim() && specification[field]) {
          copy[field] = specification[field];
        }
      });
    }
    return copy;
  });
}

function inheritAssetSpecifications_(record, sourceRecords) {
  var assetName = normalizeAssetNameForSpecification_(record.AssetName);
  if (!assetName) return;
  var source = hydrateAssetSpecifications_(sourceRecords || []).filter(function(item) {
    return normalizeAssetNameForSpecification_(item.AssetName) === assetName;
  })[0];
  if (!source) return;
  ['CPU', 'Storage', 'RAM'].forEach(function(field) {
    if (!String(record[field] || '').trim() && String(source[field] || '').trim()) {
      record[field] = String(source[field]).trim();
    }
  });
}

function getMaintenanceAgreementStatus_(record) {
  var storedStatus = String(record && record.Status || '').trim();
  if (storedStatus === 'Cancelled' || storedStatus === 'Renewal In Progress' || storedStatus === 'Renewed') {
    return storedStatus;
  }
  var endDate = normalizeDateFieldValue_(record && record.EndDate);
  if (!endDate) {
    return storedStatus || 'Active';
  }
  var today = normalizeDateFieldValue_(new Date());
  if (endDate < today) {
    return 'Expired';
  }
  var noticeDays = Number(record && record.RenewalNoticeDays || 60);
  if (!isFinite(noticeDays) || noticeDays < 0) {
    noticeDays = 60;
  }
  var expiryDate = new Date(endDate + 'T00:00:00');
  expiryDate.setDate(expiryDate.getDate() - noticeDays);
  if (today >= Utilities.formatDate(expiryDate, APP_TIME_ZONE, 'yyyy-MM-dd')) {
    return 'Expiring';
  }
  return 'Active';
}

function getMaintenanceContractFolder_() {
  var properties = PropertiesService.getScriptProperties();
  var folderId = String(
    properties.getProperty('MA_CONTRACT_FOLDER_ID') ||
    properties.getProperty('KNOWLEDGE_DRIVE_FOLDER_ID') ||
    ''
  ).trim();
  if (!folderId) {
    throw new Error('Contract upload folder is not configured. Set MA_CONTRACT_FOLDER_ID in Script properties.');
  }
  return DriveApp.getFolderById(folderId);
}

function renewMaintenanceAgreement_(agreementId, renewalValues, filePayload, sessionUser) {
  var module = assertModuleAccess_('maintenanceAgreements', sessionUser.Role, 'create');
  assertModuleAccess_('maintenanceAgreements', sessionUser.Role, 'edit');
  var current = findRecordByFieldFast_(module.sheet, module.idField, agreementId, true);
  if (!current) {
    throw new Error('Maintenance agreement not found');
  }
  if (String(current.Status || '') === 'Cancelled' || String(current.Status || '') === 'Renewed') {
    throw new Error('This maintenance agreement cannot be renewed');
  }

  assertKnowledgeUploadFile_(filePayload || {});
  var uploadedFile = null;
  try {
    var bytes = Utilities.base64Decode(String(filePayload.base64));
    var blob = Utilities.newBlob(bytes, String(filePayload.type || 'application/octet-stream'), String(filePayload.name));
    uploadedFile = getMaintenanceContractFolder_().createFile(blob);

    return withWriteLock_(function() {
    current = findRecordByFieldFast_(module.sheet, module.idField, agreementId, true);
    if (!current || ['Cancelled', 'Renewed'].indexOf(String(current.Status || '')) !== -1) {
      throw new Error('This maintenance agreement cannot be renewed. Refresh the list.');
    }
    var currentRecord = normalizeRecordForSave_(module, current, false);
    currentRecord.Status = 'Renewed';
    currentRecord.UpdatedAt = getNowString_();

    var nextInput = {};
    SHEET_SCHEMAS[module.sheet].forEach(function(header) {
      nextInput[header] = current[header] != null ? current[header] : '';
    });
    Object.keys(renewalValues || {}).forEach(function(key) {
      nextInput[key] = renewalValues[key];
    });
    nextInput.AgreementID = generateSequentialIdFromColumn_(getIdPrefix_('maintenanceAgreements', module), module.sheet, module.idField);
    nextInput.RenewalOfAgreementID = current.AgreementID;
    nextInput.DocumentURL = uploadedFile.getUrl();
    nextInput.Status = 'Active';
    nextInput.CreatedAt = '';
    nextInput.UpdatedAt = '';
    var renewedRecord = normalizeRecordForSave_(module, nextInput, true);

    writeObjectToRow_(module.sheet, current.__rowNumber, currentRecord);
    appendObject_(module.sheet, renewedRecord);
    writeAuditLog_({
      action: 'RENEW',
      module: 'maintenanceAgreements',
      recordId: renewedRecord.AgreementID,
      actorUserId: sessionUser.UserID,
      actorName: sessionUser.FullName,
      actorRole: sessionUser.Role,
      detail: 'Renewed agreement ' + current.AgreementID + ' as ' + renewedRecord.AgreementID + ' with contract file ' + uploadedFile.getName()
    });
    invalidateDashboardCache_();
    return { previous: sanitizeRecord_('maintenanceAgreements', currentRecord), record: sanitizeRecord_('maintenanceAgreements', renewedRecord) };
    });
  } catch (error) {
    if (uploadedFile) {
      uploadedFile.setTrashed(true);
    }
    throw error;
  }
}

function listAssetAssignmentHistory_(assetId, sessionUser) {
  assertModuleAccess_('assets', sessionUser.Role);
  var normalizedAssetId = String(assetId || '').trim();
  if (!normalizedAssetId) {
    throw new Error('Asset ID is required');
  }
  return getCachedAssetHistoryForAsset_('AssetAssignmentHistory', normalizedAssetId)
    .filter(function(item) { return String(item.AssetID || '') === normalizedAssetId; })
    .sort(function(left, right) {
      var toTimestamp = function(value) {
        if (value instanceof Date) return value.getTime();
        var parsed = new Date(String(value || '').replace(' ', 'T'));
        return isNaN(parsed.getTime()) ? 0 : parsed.getTime();
      };
      // Latest date and time first. History ID is only a stable fallback when
      // two changes were recorded in the same second.
      return toTimestamp(right.ChangedAt) - toTimestamp(left.ChangedAt) ||
        String(right.HistoryID || '').localeCompare(String(left.HistoryID || ''));
    });
}

function recordAssetAssignmentHistory_(record, existing, sessionUser, isCreate) {
  var previousUser = String(existing && existing.User || '').trim();
  var previousLocation = String(existing && existing.Location || '').trim();
  var nextUser = String(record.User || '').trim();
  var nextLocation = String(record.Location || '').trim();
  var changed = isCreate
    ? Boolean(nextUser || nextLocation)
    : previousUser !== nextUser || previousLocation !== nextLocation;
  if (!changed) {
    return;
  }

  appendObject_('AssetAssignmentHistory', {
    HistoryID: 'ASH-' + Utilities.getUuid(),
    AssetID: record.AssetID || '',
    FixedAssetNo: record.FixedAssetNo || '',
    AssetName: record.AssetName || '',
    PreviousUser: previousUser,
    NewUser: nextUser,
    PreviousLocation: previousLocation,
    NewLocation: nextLocation,
    ChangeType: isCreate ? 'Initial Assignment' : 'Assignment Updated',
    ChangedBy: sessionUser.FullName || sessionUser.Username || '',
    ChangedAt: getNowString_(),
    Remark: record.Remark || ''
  });
}

function listComputerBorrowings_(assetId, sessionUser) {
  assertModuleAccess_('assets', sessionUser.Role);
  var normalizedAssetId = String(assetId || '').trim();
  if (!normalizedAssetId) {
    throw new Error('Asset ID is required');
  }
  return getCachedAssetHistoryForAsset_('ComputerBorrowings', normalizedAssetId)
    .filter(function(item) { return String(item.AssetID || '') === normalizedAssetId; })
    .sort(function(left, right) {
      var toTimestamp = function(record) {
        var value = record.BorrowedAt || record.ReturnedAt || record.CreatedAt || '';
        if (value instanceof Date) return value.getTime();
        var parsed = new Date(String(value).replace(' ', 'T'));
        return isNaN(parsed.getTime()) ? 0 : parsed.getTime();
      };
      return toTimestamp(right) - toTimestamp(left) ||
        String(right.BorrowingID || '').localeCompare(String(left.BorrowingID || ''));
    });
}

function getCachedAssetHistoryForAsset_(sheetName, assetId) {
  var version = PropertiesService.getScriptProperties().getProperty('MODULE_VERSION_' + sheetName) || '0';
  var cache = CacheService.getScriptCache();
  var cacheKey = 'asset-history:v1:' + sheetName + ':' + version + ':' + assetId;
  var cached = cache.get(cacheKey);
  if (cached) {
    var decoded = decodeModuleRecordsCache_(cached);
    if (decoded) return decoded;
  }

  var records = rowsToObjects_(sheetName)
    .filter(function(item) { return String(item.AssetID || '') === assetId; });
  var encoded = encodeModuleRecordsCache_(records);
  if (encoded) {
    cache.put(cacheKey, encoded, ASSET_HISTORY_CACHE_TTL_SECONDS);
  }
  return records;
}

function saveComputerBorrowing_(params, sessionUser) {
  assertModuleAccess_('assets', sessionUser.Role, 'edit');
  var assetId = String(params.assetId || '').trim();
  var borrower = String(params.borrower || '').trim();
  var department = String(params.department || '').trim();
  var cpu = String(params.cpu || '').trim();
  var storage = String(params.storage || '').trim();
  var ram = String(params.ram || '').trim();
  var signature = parsePossibleJson_(params.signature);
  if (!assetId || !borrower || !department || !cpu || !storage || !ram || !signature || !signature.base64) {
    throw new Error('Asset, borrower, department, CPU, storage, RAM, and borrower signature are required');
  }

  var signatureFile = saveTicketImage_(signature, 'computer_borrower_signature');
  try {
    return withWriteLock_(function() {
      var asset = findRecordByFieldFast_('Assets', 'AssetID', assetId, true);
      if (!asset) {
        throw new Error('Asset not found');
      }
      var hasOpenBorrowing = rowsToObjects_('ComputerBorrowings').some(function(item) {
        return String(item.AssetID || '') === assetId && String(item.Status || '') === 'Borrowed';
      });
      if (hasOpenBorrowing) {
        throw new Error('This computer is already borrowed. Return it before creating another borrowing record.');
      }

      var now = getNowString_();
      var record = {
        BorrowingID: 'CBR-' + Utilities.getUuid(),
        AssetID: asset.AssetID || '',
        FixedAssetNo: asset.FixedAssetNo || '',
        AssetName: asset.AssetName || '',
        ModelDescription: String(params.modelDescription || asset.AssetName || '').trim(),
        CPU: cpu,
        Storage: storage,
        RAM: ram,
        SerialNumber: String(params.serialNumber || asset.SerialNumber || '').trim(),
        Accessories: String(params.accessories || '').trim(),
        SoftwareInfo: String(params.softwareInfo || '').trim(),
        HandoverBy: sessionUser.FullName || sessionUser.Username || '',
        Borrower: borrower,
        BorrowerDepartment: department,
        BorrowedAt: now,
        BorrowerSignatureFileId: signatureFile.getId(),
        BorrowerSignatureUrl: signatureFile.getUrl(),
        ReturnedBy: '',
        ReturnReceivedBy: '',
        ReturnedAt: '',
        ReturnSignatureFileId: '',
        ReturnSignatureUrl: '',
        ReturnRemark: '',
        Status: 'Borrowed',
        CreatedAt: now,
        UpdatedAt: now
      };
      appendObject_('ComputerBorrowings', record);

      var updatedAsset = {};
      Object.keys(asset).forEach(function(key) { if (key !== '__rowNumber') updatedAsset[key] = asset[key]; });
      updatedAsset.User = borrower;
      updatedAsset.CPU = cpu;
      updatedAsset.Storage = storage;
      updatedAsset.RAM = ram;
      updatedAsset.UpdatedAt = now;
      writeObjectToRow_('Assets', asset.__rowNumber, updatedAsset);
      recordAssetAssignmentHistory_(updatedAsset, asset, sessionUser, false);
      writeAuditLog_({
        action: 'BORROW', module: 'assets', recordId: assetId,
        actorUserId: sessionUser.UserID, actorName: sessionUser.FullName, actorRole: sessionUser.Role,
        detail: 'Computer borrowed by ' + borrower
      });
      invalidateDashboardCache_();
      return record;
    });
  } catch (error) {
    signatureFile.setTrashed(true);
    throw error;
  }
}

function returnComputerBorrowing_(params, sessionUser) {
  assertModuleAccess_('assets', sessionUser.Role, 'edit');
  var borrowingId = String(params.borrowingId || '').trim();
  var returnedBy = String(params.returnedBy || '').trim();
  var signature = parsePossibleJson_(params.signature);
  if (!borrowingId || !returnedBy || !signature || !signature.base64) {
    throw new Error('Borrowing record, returned by, and return signature are required');
  }

  var signatureFile = saveTicketImage_(signature, 'computer_return_signature');
  try {
    return withWriteLock_(function() {
      var borrowing = findRecordByFieldFast_('ComputerBorrowings', 'BorrowingID', borrowingId, true);
      if (!borrowing || String(borrowing.Status || '') !== 'Borrowed') {
        throw new Error('Open borrowing record not found');
      }
      var asset = findRecordByFieldFast_('Assets', 'AssetID', borrowing.AssetID, true);
      if (!asset) {
        throw new Error('Related asset not found');
      }
      var now = getNowString_();
      borrowing.ReturnedBy = returnedBy;
      borrowing.ReturnReceivedBy = sessionUser.FullName || sessionUser.Username || '';
      borrowing.ReturnedAt = now;
      borrowing.ReturnSignatureFileId = signatureFile.getId();
      borrowing.ReturnSignatureUrl = signatureFile.getUrl();
      borrowing.ReturnRemark = String(params.remark || '').trim();
      borrowing.Status = 'Returned';
      borrowing.UpdatedAt = now;
      writeObjectToRow_('ComputerBorrowings', borrowing.__rowNumber, borrowing);

      var updatedAsset = {};
      Object.keys(asset).forEach(function(key) { if (key !== '__rowNumber') updatedAsset[key] = asset[key]; });
      updatedAsset.User = '';
      updatedAsset.UpdatedAt = now;
      writeObjectToRow_('Assets', asset.__rowNumber, updatedAsset);
      recordAssetAssignmentHistory_(updatedAsset, asset, sessionUser, false);
      writeAuditLog_({
        action: 'RETURN', module: 'assets', recordId: borrowing.AssetID,
        actorUserId: sessionUser.UserID, actorName: sessionUser.FullName, actorRole: sessionUser.Role,
        detail: 'Computer returned by ' + returnedBy
      });
      invalidateDashboardCache_();
      return borrowing;
    });
  } catch (error) {
    signatureFile.setTrashed(true);
    throw error;
  }
}

function createComputerReturn_(params, sessionUser) {
  assertModuleAccess_('assets', sessionUser.Role, 'edit');
  var assetId = String(params.assetId || '').trim();
  var returnedBy = String(params.returnedBy || '').trim();
  var signature = parsePossibleJson_(params.signature);
  if (!assetId || !returnedBy || !signature || !signature.base64) {
    throw new Error('Asset, returned by, and return signature are required');
  }

  var signatureFile = saveTicketImage_(signature, 'computer_return_signature');
  try {
    return withWriteLock_(function() {
      var asset = findRecordByFieldFast_('Assets', 'AssetID', assetId, true);
      if (!asset) {
        throw new Error('Asset not found');
      }
      var hasOpenBorrowing = rowsToObjects_('ComputerBorrowings').some(function(item) {
        return String(item.AssetID || '') === assetId && String(item.Status || '') === 'Borrowed';
      });
      if (hasOpenBorrowing) {
        throw new Error('An open borrowing record exists. Return that record instead.');
      }

      // The asset returned here can be an older import where the specification
      // columns are blank.  Use the same model's populated specifications before
      // taking the immutable snapshot for the borrowing form.
      var hydratedAsset = hydrateAssetSpecifications_([asset].concat(rowsToObjects_('Assets')))[0] || asset;
      var now = getNowString_();
      var record = {
        BorrowingID: 'CBR-' + Utilities.getUuid(),
        AssetID: asset.AssetID || '',
        FixedAssetNo: asset.FixedAssetNo || '',
        AssetName: asset.AssetName || '',
        ModelDescription: asset.AssetName || '',
        CPU: hydratedAsset.CPU || '',
        Storage: hydratedAsset.Storage || '',
        RAM: hydratedAsset.RAM || '',
        SerialNumber: asset.SerialNumber || '',
        Accessories: '',
        SoftwareInfo: '',
        HandoverBy: '',
        Borrower: '',
        BorrowerDepartment: '',
        BorrowedAt: '',
        BorrowerSignatureFileId: '',
        BorrowerSignatureUrl: '',
        ReturnedBy: returnedBy,
        ReturnReceivedBy: sessionUser.FullName || sessionUser.Username || '',
        ReturnedAt: now,
        ReturnSignatureFileId: signatureFile.getId(),
        ReturnSignatureUrl: signatureFile.getUrl(),
        ReturnRemark: String(params.remark || '').trim(),
        Status: 'Returned',
        CreatedAt: now,
        UpdatedAt: now
      };
      appendObject_('ComputerBorrowings', record);

      var updatedAsset = {};
      Object.keys(asset).forEach(function(key) { if (key !== '__rowNumber') updatedAsset[key] = asset[key]; });
      updatedAsset.User = '';
      updatedAsset.UpdatedAt = now;
      writeObjectToRow_('Assets', asset.__rowNumber, updatedAsset);
      recordAssetAssignmentHistory_(updatedAsset, asset, sessionUser, false);
      writeAuditLog_({
        action: 'RETURN', module: 'assets', recordId: assetId,
        actorUserId: sessionUser.UserID, actorName: sessionUser.FullName, actorRole: sessionUser.Role,
        detail: 'Standalone computer return recorded by ' + returnedBy
      });
      invalidateDashboardCache_();
      return record;
    });
  } catch (error) {
    signatureFile.setTrashed(true);
    throw error;
  }
}

function getComputerBorrowingPdfData_(borrowingId, sessionUser) {
  assertModuleAccess_('assets', sessionUser.Role);
  var borrowing = findRecordByFieldFast_('ComputerBorrowings', 'BorrowingID', borrowingId, true);
  if (!borrowing) {
    throw new Error('Borrowing record not found');
  }
  var toDataUrl = function(fileId, fileUrl) {
    var resolvedId = String(fileId || '').trim();
    // Some early records retained the Drive URL but not the File ID. Recover
    // that ID so their saved signatures remain printable.
    if (!resolvedId) {
      var idMatch = String(fileUrl || '').match(/[-\w]{25,}/);
      resolvedId = idMatch ? idMatch[0] : '';
    }
    if (!resolvedId) return '';
    try {
      var blob = DriveApp.getFileById(resolvedId).getBlob();
      return 'data:' + (blob.getContentType() || 'image/png') + ';base64,' + Utilities.base64Encode(blob.getBytes());
    } catch (error) {
      return '';
    }
  };
  // Older borrowing/return records may have been saved before CPU, Storage and
  // RAM were added to the asset import.  Populate only blank display values from
  // the current asset/model; never overwrite the values saved on the form.
  var displayRecord = {};
  Object.keys(borrowing).forEach(function(key) { displayRecord[key] = borrowing[key]; });
  var relatedAsset = findRecordByFieldFast_('Assets', 'AssetID', borrowing.AssetID, false);
  var assetRecords = relatedAsset ? hydrateAssetSpecifications_([relatedAsset].concat(rowsToObjects_('Assets'))) : [];
  var specificationSource = assetRecords[0] || relatedAsset || {};
  ['CPU', 'Storage', 'RAM'].forEach(function(field) {
    if (!String(displayRecord[field] || '').trim() && String(specificationSource[field] || '').trim()) {
      displayRecord[field] = String(specificationSource[field]).trim();
    }
  });
  return {
    record: displayRecord,
    borrowerSignature: toDataUrl(borrowing.BorrowerSignatureFileId, borrowing.BorrowerSignatureUrl),
    returnSignature: toDataUrl(borrowing.ReturnSignatureFileId, borrowing.ReturnSignatureUrl)
  };
}

function listKnowledgeCategories_(sessionUser) {
  assertModuleAccess_('documents', sessionUser.Role);
  seedMasterData_();
  return rowsToObjects_('MasterData')
    .filter(function(item) {
      return String(item.GroupName || '') === 'KnowledgeCategories' && String(item.IsActive || '').toUpperCase() !== 'FALSE';
    })
    .map(function(item) {
      return String(item.ItemLabel || '').trim();
    })
    .filter(Boolean);
}

function createKnowledgeCategory_(name, sessionUser) {
  assertModuleAccess_('documents', sessionUser.Role, 'create');
  var label = String(name || '').trim();
  if (!label || label.length > 80 || label.toLowerCase() === 'all') {
    throw new Error('Enter a folder name up to 80 characters, other than All');
  }

  var categories = listKnowledgeCategories_(sessionUser);
  var duplicate = categories.some(function(item) {
    return item.toLowerCase() === label.toLowerCase();
  });
  if (duplicate) {
    throw new Error('Category already exists');
  }

  appendObject_('MasterData', {
    GroupName: 'KnowledgeCategories',
    ItemCode: generateSequentialIdFromColumn_('KNO', 'MasterData', 'ItemCode'),
    ItemLabel: label,
    IsActive: 'TRUE',
    UpdatedAt: getNowString_()
  });
  writeAuditLog_({
    action: 'CREATE',
    module: 'documents',
    recordId: label,
    actorUserId: sessionUser.UserID,
    actorName: sessionUser.FullName,
    actorRole: sessionUser.Role,
    detail: 'Created knowledge category'
  });
  return listKnowledgeCategories_(sessionUser);
}

function renameKnowledgeCategory_(previousName, nextName, sessionUser) {
  assertModuleAccess_('documents', sessionUser.Role, 'edit');
  var previousLabel = String(previousName || '').trim();
  var nextLabel = String(nextName || '').trim();
  if (!previousLabel || !nextLabel || nextLabel.length > 80 || nextLabel.toLowerCase() === 'all') {
    throw new Error('Enter a folder name up to 80 characters, other than All');
  }
  if (previousLabel === nextLabel) {
    return { categories: listKnowledgeCategories_(sessionUser), updatedDocuments: 0 };
  }

  var masterCategory = rowsToObjectsWithMeta_('MasterData', true).filter(function(item) {
    return String(item.GroupName || '') === 'KnowledgeCategories' && String(item.ItemLabel || '').trim() === previousLabel;
  })[0];
  if (!masterCategory) {
    throw new Error('Category not found');
  }
  var duplicate = listKnowledgeCategories_(sessionUser).some(function(item) {
    return String(item).toLowerCase() === nextLabel.toLowerCase();
  });
  if (duplicate) {
    throw new Error('Category already exists');
  }

  masterCategory.ItemLabel = nextLabel;
  masterCategory.UpdatedAt = getNowString_();
  writeObjectToRow_('MasterData', masterCategory.__rowNumber, masterCategory);

  var documents = rowsToObjectsWithMeta_('Documents', true).filter(function(item) {
    return String(item.Category || '').trim() === previousLabel;
  });
  if (documents.length) {
    var categoryColumn = SHEET_SCHEMAS.Documents.indexOf('Category') + 1;
    var documentsSheet = ensureSheet_('Documents', SHEET_SCHEMAS.Documents);
    var columnName = documentsSheet.getRange(1, categoryColumn).getA1Notation().replace(/\d+$/, '');
    documentsSheet.getRangeList(documents.map(function(item) {
      return columnName + item.__rowNumber;
    })).setValue(nextLabel);
    invalidateModuleRecords_('Documents');
  }
  writeAuditLog_({
    action: 'UPDATE',
    module: 'documents',
    recordId: masterCategory.ItemCode || previousLabel,
    actorUserId: sessionUser.UserID,
    actorName: sessionUser.FullName,
    actorRole: sessionUser.Role,
    detail: 'Renamed knowledge category from "' + previousLabel + '" to "' + nextLabel + '"; updated ' + documents.length + ' document(s)'
  });
  invalidateDashboardCache_();
  return { categories: listKnowledgeCategories_(sessionUser), updatedDocuments: documents.length };
}

function deleteKnowledgeCategory_(folderName, confirmation, expectedDocumentIds, sessionUser) {
  assertModuleAccess_('documents', sessionUser.Role, 'delete');
  var label = String(folderName || '').trim();
  if (!label || label.toLowerCase() === 'all' || String(confirmation || '') !== 'delete') {
    throw new Error('Type delete to confirm folder removal');
  }

  var categoryRows = rowsToObjectsWithMeta_('MasterData', true).filter(function(item) {
    return String(item.GroupName || '') === 'KnowledgeCategories' && String(item.ItemLabel || '').trim() === label;
  });
  var allDocuments = rowsToObjectsWithMeta_('Documents', true);
  var documents = allDocuments.filter(function(item) {
    return String(item.Category || '').trim() === label;
  });
  var expectedIds = Array.isArray(expectedDocumentIds)
    ? expectedDocumentIds.map(function(id) { return String(id); }).sort()
    : null;
  var actualIds = documents.map(function(item) { return String(item.DocumentID || ''); }).sort();
  if (!expectedIds || JSON.stringify(expectedIds) !== JSON.stringify(actualIds)) {
    throw new Error('Folder contents changed. Refresh the page and review the files before deleting.');
  }
  if (!categoryRows.length && !documents.length) {
    throw new Error('Folder not found. Refresh the page and try again.');
  }
  if (typeof Sheets === 'undefined') {
    throw new Error('Sheets service is unavailable. Folder deletion was not started.');
  }

  // Files shared with another document must remain available to that document.
  var retainedFileIds = {};
  allDocuments.forEach(function(item) {
    if (String(item.Category || '').trim() !== label && item.DriveFileId) {
      retainedFileIds[String(item.DriveFileId)] = true;
    }
  });
  var fileIds = {};
  documents.forEach(function(item) {
    var fileId = String(item.DriveFileId || '').trim();
    if (fileId && !retainedFileIds[fileId]) fileIds[fileId] = true;
  });
  var files = Object.keys(fileIds).map(function(id) { return DriveApp.getFileById(id); });

  function deleteRowRequests_(sheetName, records) {
    var rows = records.map(function(item) { return item.__rowNumber; }).sort(function(a, b) { return b - a; });
    var sheetId = ensureSheet_(sheetName, SHEET_SCHEMAS[sheetName]).getSheetId();
    var requests = [];
    for (var index = 0; index < rows.length; index++) {
      var high = rows[index];
      var low = high;
      while (index + 1 < rows.length && rows[index + 1] === low - 1) {
        low = rows[++index];
      }
      requests.push({ deleteDimension: { range: {
        sheetId: sheetId,
        dimension: 'ROWS',
        startIndex: low - 1,
        endIndex: high
      } } });
    }
    return requests;
  }

  var requests = deleteRowRequests_('Documents', documents)
    .concat(deleteRowRequests_('MasterData', categoryRows));
  var trashed = [];
  try {
    files.forEach(function(file) {
      file.setTrashed(true);
      trashed.push(file);
    });
    Sheets.Spreadsheets.batchUpdate({ requests: requests }, getSpreadsheet_().getId());
  } catch (error) {
    trashed.forEach(function(file) {
      try { file.setTrashed(false); } catch (restoreError) {
        console.error('Unable to restore file after folder deletion failed: ' + restoreError.message);
      }
    });
    throw error;
  }

  invalidateModuleRecords_('Documents');
  invalidateModuleRecords_('MasterData');
  invalidateDashboardCache_();
  writeAuditLog_({
    action: 'DELETE',
    module: 'documents',
    recordId: label,
    actorUserId: sessionUser.UserID,
    actorName: sessionUser.FullName,
    actorRole: sessionUser.Role,
    detail: 'Deleted knowledge folder and ' + documents.length + ' document(s); trashed ' + files.length + ' file(s)'
  });
  return { deleted: true, deletedDocuments: documents.length, trashedFiles: files.length };
}

function getKnowledgeDriveFolder_() {
  var properties = PropertiesService.getScriptProperties();
  var folderId = String(properties.getProperty('KNOWLEDGE_DRIVE_FOLDER_ID') || '').trim();
  if (folderId) {
    try {
      return DriveApp.getFolderById(folderId);
    } catch (error) {
      properties.deleteProperty('KNOWLEDGE_DRIVE_FOLDER_ID');
    }
  }

  var folder = DriveApp.createFolder('IT Knowledge Center');
  properties.setProperty('KNOWLEDGE_DRIVE_FOLDER_ID', folder.getId());
  return folder;
}

// Run once from the Apps Script editor to authorize Drive and prepare file storage.
function setupKnowledgeDrive() {
  var folder = getKnowledgeDriveFolder_();
  return {
    folderId: folder.getId(),
    folderUrl: folder.getUrl(),
    message: 'IT Knowledge Center storage is ready'
  };
}

function assertKnowledgeUploadFile_(file) {
  var allowedMimeTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/png',
    'image/jpeg',
    'image/webp'
  ];
  var allowedExtensions = ['pdf', 'docx', 'xlsx', 'pptx', 'png', 'jpg', 'jpeg', 'webp'];
  var fileName = String(file.name || '').trim();
  var extension = fileName.split('.').pop().toLowerCase();
  var mimeType = String(file.type || '').trim().toLowerCase();
  var fileSize = Number(file.size || 0);

  if (!fileName || !file.base64) {
    throw new Error('Uploaded file is incomplete');
  }
  if (fileSize <= 0 || fileSize > 10 * 1024 * 1024) {
    throw new Error('File size must be between 1 byte and 10 MB');
  }
  if (allowedExtensions.indexOf(extension) === -1 || (mimeType && allowedMimeTypes.indexOf(mimeType) === -1)) {
    throw new Error('Unsupported file type. Use PDF, DOCX, XLSX, PPTX, PNG, JPG, JPEG or WEBP');
  }
}

// Knowledge Center files must be previewable through the internal proxy.
// Keep the broader validator above for MA contract attachments.
function assertKnowledgePreviewFile_(file) {
  var mimeByExtension = {
    pdf: 'application/pdf',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp'
  };
  var fileName = String(file && file.name || '').trim();
  var extension = fileName.split('.').pop().toLowerCase();
  var mimeType = String(file && file.type || '').trim().toLowerCase();

  if (!mimeByExtension[extension] || mimeType !== mimeByExtension[extension]) {
    throw new Error('Knowledge Center accepts PDF, PNG, JPG, JPEG or WEBP files only so every upload can be previewed');
  }
}

function getTicketUploadFolder_() {
  var properties = PropertiesService.getScriptProperties();
  var folderId = String(
    properties.getProperty('TICKET_DRIVE_FOLDER_ID') ||
    properties.getProperty('KNOWLEDGE_DRIVE_FOLDER_ID') ||
    ''
  ).trim();
  if (!folderId) {
    throw new Error('Ticket upload folder is not configured. Set TICKET_DRIVE_FOLDER_ID in Script properties.');
  }
  return DriveApp.getFolderById(folderId);
}

function assertTicketImageFile_(file) {
  var fileName = String(file && file.name || '').trim();
  var mimeType = String(file && file.type || '').toLowerCase();
  var fileSize = Number(file && file.size || 0);
  var allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
  var extension = fileName.split('.').pop().toLowerCase();
  var allowedExtensions = ['jpg', 'jpeg', 'png', 'webp'];

  if (!fileName || !file || !file.base64) {
    throw new Error('Attached photo is incomplete');
  }
  if (fileSize <= 0 || fileSize > 5 * 1024 * 1024) {
    throw new Error('Photo must be between 1 byte and 5 MB');
  }
  if (allowedMimeTypes.indexOf(mimeType) === -1 || allowedExtensions.indexOf(extension) === -1) {
    throw new Error('Only JPG, PNG or WEBP photos are allowed');
  }
}

function createPublicTicket_(params, sessionUser) {
  var requester = String(params.requester || '').trim();
  var department = String(params.department || '').trim();
  var contact = String(params.contact || '').trim();
  var category = String(params.category || '').trim();
  var requestedService = String(params.requestedService || '').trim();
  var remoteStartedAt = String(params.remoteStartedAt || '').trim();
  var remoteEndedAt = String(params.remoteEndedAt || '').trim();
  var subject = String(params.subject || '').trim();
  var location = String(params.location || '').trim();
  var clientId = String(params.clientId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
  var clientRequestId = String(params.clientRequestId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 100);
  var file = parsePossibleJson_(params.file);
  var inventoryItemId = String(params.inventoryItemId || '').trim();
  var requestedQuantity = Number(params.requestedQuantity || 0);
  var requestSignature = parsePossibleJson_(params.requestSignature);
  var isEquipmentRequisition = requestedService === 'Equipment Requisition';
  var isRemoteSupport = requestedService === 'Remote Support';
  if (isEquipmentRequisition && !category) {
    category = 'Equipment';
  }

  if (String(params.website || '').trim()) {
    throw new Error('Unable to submit this ticket');
  }
  if (!requester || !department || !requestedService || !category || (!isEquipmentRequisition && !subject) || !location) {
    throw new Error('Please complete all required fields');
  }
  if (['On-site', 'Remote Support', 'Equipment Requisition'].indexOf(requestedService) === -1) {
    throw new Error('Invalid requested service');
  }
  if (isRemoteSupport) {
    var timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (!timePattern.test(remoteStartedAt) || !timePattern.test(remoteEndedAt)) {
      throw new Error('Remote support start time and end time are required');
    }
    if (remoteEndedAt < remoteStartedAt) {
      throw new Error('Remote support end time must be after start time');
    }
  }
  if (isEquipmentRequisition && (!inventoryItemId || !isFinite(requestedQuantity) || requestedQuantity <= 0 || !requestSignature || !requestSignature.base64)) {
    throw new Error('Select an inventory item, enter a quantity, and provide the requester signature');
  }
  if (requester.length > 120 || contact.length > 160 || subject.length > 180 || location.length > 240) {
    throw new Error('One or more fields are too long');
  }

  var uploadedFile = null;
  var requestSignatureFile = null;
  var attachment = {};
  if (file && file.base64) {
    assertTicketImageFile_(file);
    var bytes = Utilities.base64Decode(String(file.base64));
    uploadedFile = getTicketUploadFolder_().createFile(
      Utilities.newBlob(bytes, String(file.type), String(file.name))
    );
    attachment = {
      AttachmentFileId: uploadedFile.getId(),
      AttachmentUrl: uploadedFile.getUrl(),
      AttachmentFileName: uploadedFile.getName()
    };
  }
  if (isEquipmentRequisition) {
    requestSignatureFile = saveTicketImage_(requestSignature, 'equipment_request_signature');
  }

  try {
    return withWriteLock_(function() {
      var cache = CacheService.getScriptCache();
      if (clientRequestId) {
        var existingTicket = findRecordByFieldFast_('Tickets', 'ClientRequestID', clientRequestId, true);
        if (existingTicket) {
          if (uploadedFile) uploadedFile.setTrashed(true);
          if (requestSignatureFile) requestSignatureFile.setTrashed(true);
          return { TicketID: existingTicket.TicketID, Status: existingTicket.Status, duplicate: true };
        }
      }
      var rateKey = 'publicTicket:' + (clientRequestId || clientId || requester.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 48));
      if (cache.get(rateKey)) {
        throw new Error('Please wait 2 minutes before submitting another ticket');
      }

      var module = MODULES.tickets;
      if (isEquipmentRequisition) {
        var stockItem = findRecordByFieldFast_('StockItems', 'ItemID', inventoryItemId, true);
        if (!stockItem || Number(stockItem.Quantity || 0) < requestedQuantity) {
          throw new Error('The requested inventory quantity is no longer available');
        }
      }
      var now = getNowString_();
      var record = normalizeRecordForSave_(module, {
        RequestDate: normalizeDateFieldValue_(new Date()),
        Requester: requester,
        Department: department,
        Contact: contact,
        Location: location,
        RequestedService: requestedService,
        Category: category,
        InventoryItemID: isEquipmentRequisition ? inventoryItemId : '',
        RequestedQuantity: isEquipmentRequisition ? requestedQuantity : '',
        Priority: 'Medium',
        Subject: subject,
        Description: '',
        AssignedTo: isRemoteSupport ? (sessionUser.FullName || sessionUser.Username || '') : '',
        Status: isRemoteSupport ? 'Resolved' : 'Open',
        ServiceMethod: isRemoteSupport ? 'Remote Support' : '',
        WorkStartedAt: isRemoteSupport ? remoteStartedAt : '',
        WorkCompletedAt: isRemoteSupport ? remoteEndedAt : '',
        ResolvedDate: isRemoteSupport ? normalizeDateFieldValue_(new Date()) : '',
        ClientRequestID: clientRequestId,
        Remark: 'Submitted from public ticket form'
      }, true);
      Object.keys(attachment).forEach(function(key) {
        record[key] = attachment[key];
      });
      if (requestSignatureFile) {
        record.RequestSignatureFileId = requestSignatureFile.getId();
        record.RequestSignatureUrl = requestSignatureFile.getUrl();
      }
      record.TicketID = generateMonthlyTicketId_();

      appendObject_('Tickets', record);
      writeAuditLog_({
        action: 'CREATE',
        module: 'tickets',
        recordId: record.TicketID,
        actorName: requester,
        actorRole: 'Public requester',
        detail: 'Created ticket from public ticket form'
      });
      cache.put(rateKey, '1', 120);
      invalidateDashboardCache_();
      return { TicketID: record.TicketID, Status: record.Status };
    });
  } catch (error) {
    if (uploadedFile) {
      uploadedFile.setTrashed(true);
    }
    if (requestSignatureFile) {
      requestSignatureFile.setTrashed(true);
    }
    throw error;
  }
}

function createUserRequest_(params) {
  var requestedService = String(params.requestedService || '').trim();
  if (['On-site', 'Equipment Requisition'].indexOf(requestedService) === -1) {
    throw new Error('User Request supports On-site Support and Equipment Requisition only');
  }
  return createPublicTicket_(params, {});
}

function listPublicInventoryItems_() {
  return rowsToObjects_('StockItems')
    .filter(function(item) {
      return Number(item.Quantity || 0) > 0;
    })
    .map(function(item) {
      return {
        ItemID: item.ItemID || '',
        ItemName: item.ItemName || '',
        Category: item.Category || '',
        Quantity: Number(item.Quantity || 0),
        Unit: item.Unit || ''
      };
    });
}

function listPublicTicketJobs_() {
  return getPublicTicketWorkspace_().records;
}

function getPublicTicketWorkspace_() {
  var openRecords = getCachedModuleRecords_('Tickets')
    .filter(function(record) {
      return ['resolved', 'closed', 'rejected'].indexOf(String(record.Status || 'Open').toLowerCase()) === -1;
    })
    .map(function(record) {
      return {
        TicketID: record.TicketID || '',
        RequestDate: record.RequestDate || '',
        Requester: record.Requester || '',
        Department: record.Department || '',
        Location: record.Location || '',
        RequestedService: record.RequestedService || '',
        Category: record.Category || '',
        InventoryItemID: record.InventoryItemID || '',
        RequestedQuantity: record.RequestedQuantity || '',
        Subject: record.Subject || '',
        Status: record.Status || 'Open',
        WorkStartedAt: record.WorkStartedAt || '',
        WorkCompletedAt: record.WorkCompletedAt || '',
        ResolvedDate: record.ResolvedDate || ''
      };
    })
    .sort(function(left, right) {
      return String(right.RequestDate || '').localeCompare(String(left.RequestDate || '')) ||
        String(right.TicketID || '').localeCompare(String(left.TicketID || ''));
    });
  return {
    openCount: openRecords.length,
    records: openRecords.slice(0, 100)
  };
}

function getPublicTicketJobSummary_() {
  return { openCount: getPublicTicketWorkspace_().openCount };
}

function saveTicketImage_(file, prefix) {
  assertTicketImageFile_(file);
  var bytes = Utilities.base64Decode(String(file.base64));
  var safeName = String(file.name || 'image').replace(/[^a-zA-Z0-9._-]/g, '_');
  var fileName = prefix + '_' + new Date().getTime() + '_' + safeName;
  return getTicketUploadFolder_().createFile(
    Utilities.newBlob(bytes, String(file.type), fileName)
  );
}

function getTicketSignatures_(params, sessionUser) {
  assertModuleAccess_('tickets', sessionUser.Role);
  var ticketId = String(params.ticketId || '').trim();
  if (!ticketId) {
    throw new Error('Ticket ID is required');
  }
  var ticket = findRecordByFieldFast_('Tickets', 'TicketID', ticketId, false);
  if (!ticket || !applyRoleScope_('tickets', [ticket], sessionUser).length) {
    throw new Error('Ticket not found or access denied');
  }

  var toDataUrl = function(fileId) {
    if (!fileId) return '';
    var blob = DriveApp.getFileById(String(fileId)).getBlob();
    return 'data:' + (blob.getContentType() || 'image/png') + ';base64,' + Utilities.base64Encode(blob.getBytes());
  };
  var createdAt = ticket.CreatedAt || '';
  var auditLogs = rowsToObjects_('AuditLogs');
  for (var index = 0; index < auditLogs.length; index += 1) {
    var audit = auditLogs[index];
    if (String(audit.RecordID || '') === ticketId && String(audit.Module || '') === 'tickets' && String(audit.Action || '') === 'CREATE') {
      createdAt = audit.Timestamp || createdAt;
      break;
    }
  }
  return {
    requestSignature: toDataUrl(ticket.RequestSignatureFileId),
    resolutionSignature: toDataUrl(ticket.ResolutionSignatureFileId),
    createdAt: createdAt
  };
}

function getTicketRecord_(ticketId, sessionUser) {
  assertModuleAccess_('tickets', sessionUser.Role);
  var normalizedTicketId = String(ticketId || '').trim();
  if (!normalizedTicketId) {
    throw new Error('Ticket ID is required');
  }
  var ticket = findRecordByFieldFast_('Tickets', 'TicketID', normalizedTicketId, false);
  if (!ticket || !applyRoleScope_('tickets', [ticket], sessionUser).length) {
    throw new Error('Ticket not found or access denied');
  }
  return sanitizeRecord_('tickets', ticket);
}

function resolveTicket_(params, sessionUser) {
  assertModuleAccess_('tickets', sessionUser.Role, 'edit');
  var ticketId = String(params.ticketId || '').trim();
  var signature = parsePossibleJson_(params.signature);
  var photo = parsePossibleJson_(params.photo);
  var resolutionNote = String(params.resolutionNote || '').trim();
  var closeDirectly = String(params.closeDirectly || '').toLowerCase() === 'true';
  var workStartedAt = String(params.workStartedAt || '').trim();
  var workCompletedAt = String(params.workCompletedAt || '').trim();

  if (!ticketId) {
    throw new Error('Ticket ID is required');
  }
  if (closeDirectly && (!workStartedAt || !workCompletedAt)) {
    throw new Error('Remote support start and end times are required');
  }

  var signatureFile = null;
  var photoFile = null;
  try {
    if (!closeDirectly && signature && signature.base64) {
      signatureFile = saveTicketImage_(signature, 'ticket_signature');
    }
    if (photo && photo.base64) {
      photoFile = saveTicketImage_(photo, 'ticket_resolution');
    }

    return withWriteLock_(function() {
      var existing = findRecordByFieldFast_('Tickets', 'TicketID', ticketId, true);
      if (!existing) {
        throw new Error('Ticket not found');
      }
      if (['Resolved', 'Closed', 'Rejected'].indexOf(String(existing.Status || '')) !== -1) {
        throw new Error('This ticket has already been completed');
      }
      if (closeDirectly && String(existing.RequestedService || '') !== 'Remote Support') {
        throw new Error('Only Remote Support tickets can be closed without requester signature');
      }
      var isEquipmentRequisition = String(existing.RequestedService || '') === 'Equipment Requisition';
      if (!closeDirectly && !isEquipmentRequisition && !signatureFile) {
        throw new Error('Requester signature is required');
      }

      var record = {};
      Object.keys(existing).forEach(function(key) {
        if (key !== '__rowNumber') {
          record[key] = existing[key];
        }
      });
      record.AssignedTo = sessionUser.FullName || sessionUser.Username || '';
      record.Status = closeDirectly ? 'Closed' : 'Resolved';
      record.ResolvedDate = normalizeDateFieldValue_(new Date());
      record.ServiceMethod = closeDirectly ? 'Remote Support' : (record.ServiceMethod || 'On-site');
      record.WorkStartedAt = closeDirectly ? workStartedAt : (record.WorkStartedAt || getNowString_());
      record.WorkCompletedAt = closeDirectly ? workCompletedAt : getNowString_();
      record.ResolutionNote = resolutionNote;
      if (isEquipmentRequisition) {
        var quantity = Number(existing.RequestedQuantity || 0);
        var itemId = String(existing.InventoryItemID || '').trim();
        if (!itemId || !isFinite(quantity) || quantity <= 0) {
          throw new Error('Equipment request is missing its inventory item or quantity');
        }
        saveStockMovementFast_(MODULES.stockMovements, {
          MovementDate: getNowString_(),
          ItemID: itemId,
          MovementType: 'Outbound',
          Quantity: quantity,
          ReferenceNo: ticketId,
          PerformedBy: sessionUser.FullName || sessionUser.Username || '',
          Remark: 'Issued from equipment requisition ticket ' + ticketId
        }, sessionUser, true);
        record.ServiceMethod = 'Equipment Requisition';
      }
      if (signatureFile) {
        record.ResolutionSignatureFileId = signatureFile.getId();
        record.ResolutionSignatureUrl = signatureFile.getUrl();
      }
      if (photoFile) {
        record.ResolutionPhotoFileId = photoFile.getId();
        record.ResolutionPhotoUrl = photoFile.getUrl();
      }
      record.UpdatedAt = getNowString_();

      writeObjectToRow_('Tickets', existing.__rowNumber, record);
      writeAuditLog_({
        action: 'RESOLVE',
        module: 'tickets',
        recordId: ticketId,
        actorUserId: sessionUser.UserID,
        actorName: sessionUser.FullName,
        actorRole: sessionUser.Role,
        detail: closeDirectly ? 'Closed remote support ticket' : 'Resolved ticket with requester signature'
      });
      invalidateDashboardCache_();
      return sanitizeRecord_('tickets', record);
    });
  } catch (error) {
    if (signatureFile) {
      signatureFile.setTrashed(true);
    }
    if (photoFile) {
      photoFile.setTrashed(true);
    }
    throw error;
  }
}

function saveKnowledgeDocument_(incomingRecord, filePayload, sessionUser, isCreate) {
  assertModuleAccess_('documents', sessionUser.Role, isCreate ? 'create' : 'edit');
  var incoming = incomingRecord || {};
  var uploadedFile = null;
  var uploadMetadata = null;
  if (filePayload && filePayload.base64) {
    assertKnowledgeUploadFile_(filePayload);
    assertKnowledgePreviewFile_(filePayload);
    var folder = getKnowledgeDriveFolder_();
    var bytes = Utilities.base64Decode(String(filePayload.base64));
    var blob = Utilities.newBlob(bytes, String(filePayload.type || 'application/octet-stream'), String(filePayload.name));
    uploadedFile = folder.createFile(blob);
    uploadMetadata = {
      DriveFileId: uploadedFile.getId(),
      LinkURL: uploadedFile.getUrl(),
      FileName: uploadedFile.getName(),
      MimeType: uploadedFile.getMimeType(),
      FileSize: Number(filePayload.size || bytes.length),
      UploadedBy: sessionUser.FullName || sessionUser.Username || '',
      UploadedAt: getNowString_()
    };
  }

  try {
    return withWriteLock_(function() {
      var existing = null;
      if (!isCreate) {
        existing = findRecordByFieldFast_('Documents', 'DocumentID', incoming.DocumentID, true);
        if (!existing) {
          throw new Error('Document not found');
        }
      }

      var record = {};
      Object.keys(existing || {}).forEach(function(key) {
        if (key !== '__rowNumber') {
          record[key] = existing[key];
        }
      });
      Object.keys(incoming).forEach(function(key) {
        record[key] = incoming[key];
      });
      Object.keys(uploadMetadata || {}).forEach(function(key) {
        record[key] = uploadMetadata[key];
      });
      record.Status = record.Status || 'Draft';
      record.LastUpdatedBy = sessionUser.FullName || sessionUser.Username || '';
      record.Version = uploadMetadata
        ? String(Number(existing && existing.Version || 0) + 1)
        : (record.Version || '1');

      if (record.Status !== 'Draft' && !String(record.LinkURL || '').trim()) {
        throw new Error('Upload a supported file or provide a Google Drive link before publishing');
      }
      return saveRecord_('documents', record, sessionUser, isCreate);
    });
  } catch (error) {
    if (uploadedFile) {
      uploadedFile.setTrashed(true);
    }
    throw error;
  }
}

// Return preview bytes through the authenticated Apps Script API.  This mirrors
// SafeDocs: the browser receives an object URL, never a drive.google.com URL.
function getKnowledgePreviewData_(documentId, sessionUser) {
  assertModuleAccess_('documents', sessionUser.Role);
  var id = String(documentId || '').trim();
  if (!id) {
    throw new Error('Document ID is required');
  }

  var record = findRecordByFieldFast_('Documents', 'DocumentID', id, true);
  if (!record || !String(record.DriveFileId || '').trim()) {
    throw new Error('This document is not stored in Knowledge Center');
  }

  var file = DriveApp.getFileById(String(record.DriveFileId));
  var sourceBlob = file.getBlob();
  var sourceMimeType = String(sourceBlob.getContentType() || record.MimeType || '').toLowerCase();
  var directPreviewTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
  if (directPreviewTypes.indexOf(sourceMimeType) === -1) {
    throw new Error('In-app preview supports PDF, PNG, JPG, and WEBP files only. Download Office files instead.');
  }

  var bytes = sourceBlob.getBytes();
  if (bytes.length > KNOWLEDGE_PREVIEW_MAX_BYTES) {
    throw new Error('This file is too large for in-app preview. Use Download instead.');
  }

  return {
    fileName: file.getName(),
    mimeType: sourceMimeType,
    base64: Utilities.base64Encode(bytes)
  };
}

function saveStockItemFast_(module, incomingRecord, sessionUser, isCreate) {
  var record = normalizeRecordForSave_(module, incomingRecord, isCreate);
  var rowNumber;

  if (isCreate) {
    if (!String(record.ItemID || '').trim()) {
      record.ItemID = generateSequentialIdFromColumn_('STK', module.sheet, 'ItemID');
    } else if (findRowNumberByField_(module.sheet, 'ItemID', record.ItemID)) {
      throw new Error('ItemID already exists');
    }
    appendObject_(module.sheet, record);
  } else {
    rowNumber = findRowNumberByField_(module.sheet, 'ItemID', record.ItemID);
    if (!rowNumber) {
      throw new Error('Record not found');
    }
    writeObjectToRow_(module.sheet, rowNumber, record);
  }

  writeAuditLog_({
    action: isCreate ? 'CREATE' : 'UPDATE',
    module: 'stockItems',
    recordId: record.ItemID,
    actorUserId: sessionUser.UserID,
    actorName: sessionUser.FullName,
    actorRole: sessionUser.Role,
    detail: (isCreate ? 'Created' : 'Updated') + ' record in ' + module.sheet
  });
  invalidateDashboardCache_();
  return sanitizeRecord_('stockItems', record);
}

function saveStockMovementFast_(module, incomingRecord, sessionUser, isCreate) {
  var record = normalizeRecordForSave_(module, incomingRecord, isCreate);
  var rowNumber;
  var previousRecord;

  if (isCreate) {
    if (!String(record.MovementID || '').trim()) {
      record.MovementID = generateSequentialIdFromColumn_('MOV', module.sheet, 'MovementID');
    } else if (findRowNumberByField_(module.sheet, 'MovementID', record.MovementID)) {
      throw new Error('MovementID already exists');
    }
    applyStockMovementToInventory_(record, false);
    appendObject_(module.sheet, record);
  } else {
    rowNumber = findRowNumberByField_(module.sheet, 'MovementID', record.MovementID);
    if (!rowNumber) {
      throw new Error('Record not found');
    }
    previousRecord = readObjectFromRow_(module.sheet, rowNumber);
    applyStockMovementToInventory_(previousRecord, true);
    try {
      applyStockMovementToInventory_(record, false);
      writeObjectToRow_(module.sheet, rowNumber, record);
    } catch (error) {
      applyStockMovementToInventory_(previousRecord, false);
      throw error;
    }
  }

  writeAuditLog_({
    action: isCreate ? 'CREATE' : 'UPDATE',
    module: 'stockMovements',
    recordId: record.MovementID,
    actorUserId: sessionUser.UserID,
    actorName: sessionUser.FullName,
    actorRole: sessionUser.Role,
    detail: (isCreate ? 'Created' : 'Updated') + ' record in ' + module.sheet
  });
  invalidateDashboardCache_();
  return sanitizeRecord_('stockMovements', record);
}

function saveRecord_(moduleKey, incomingRecord, sessionUser, isCreate) {
  const module = assertModuleAccess_(moduleKey, sessionUser.Role, isCreate ? 'create' : 'edit');
  if (moduleKey === 'stockItems') {
    return saveStockItemFast_(module, incomingRecord, sessionUser, isCreate);
  }
  if (moduleKey === 'stockMovements') {
    return saveStockMovementFast_(module, incomingRecord, sessionUser, isCreate);
  }
  var record = normalizeRecordForSave_(module, incomingRecord, isCreate);

  if (moduleKey === 'tickets') {
    if (isCreate) {
      record.RequestDate = record.RequestDate || normalizeDateFieldValue_(new Date());
      record.Status = record.Status || 'Open';
      record.AssignedTo = record.AssignedTo || sessionUser.FullName || sessionUser.Username || '';
    }
  }

  if (moduleKey === 'accessRequests' && isCreate) {
    record.RequestDate = record.RequestDate || normalizeDateFieldValue_(new Date());
    record.Status = 'Pending Approval';
    record.ApprovedBy = '';
  }

  if (isCreate && !String(record[module.idField] || '').trim()) {
    record[module.idField] = moduleKey === 'tickets'
      ? generateMonthlyTicketId_()
      : generateSequentialIdFromColumn_(getIdPrefix_(moduleKey, module), module.sheet, module.idField);
  }

  const existing = findRecordByFieldFast_(module.sheet, module.idField, record[module.idField], true);
  if (isCreate && existing) {
    throw new Error(module.idField + ' already exists');
  }
  if (!isCreate && !existing) {
    throw new Error('Record not found');
  }

  // Workspace list endpoints may omit large file/signature fields.  Preserve
  // those fields during an edit unless the submitted form explicitly changes them.
  if (!isCreate) {
    record = normalizeRecordForSave_(module, Object.assign({}, existing, incomingRecord || {}), false);
  }

  if (moduleKey === 'assets') {
    var fixedAssetNo = normalizeFixedAssetNo_(record.FixedAssetNo);
    if (fixedAssetNo) {
      var duplicateFixedAsset = findRecordByFieldFast_(module.sheet, 'FixedAssetNo', record.FixedAssetNo, false);
      if (duplicateFixedAsset && (!existing || duplicateFixedAsset.__rowNumber !== existing.__rowNumber)) {
        throw new Error('Fixed Assets No. already exists: ' + record.FixedAssetNo);
      }
    }
    inheritAssetSpecifications_(record, rowsToObjects_('Assets'));
  }

  if (moduleKey === 'users') {
    record.Department = record.Department || 'IT';
    record.Email = record.Email || '';
    record.Status = record.Status || 'Active';
    prepareUserPasswordFields_(record, existing);
  }

  if (isCreate) {
    appendObject_(module.sheet, record);
  } else {
    writeObjectToRow_(module.sheet, existing.__rowNumber, record);
  }
  if (moduleKey === 'assets') {
    recordAssetAssignmentHistory_(record, existing, sessionUser, isCreate);
  }
  writeAuditLog_({
    action: isCreate ? 'CREATE' : 'UPDATE',
    module: moduleKey,
    recordId: record[module.idField],
    actorUserId: sessionUser.UserID,
    actorName: sessionUser.FullName,
    actorRole: sessionUser.Role,
    detail: (isCreate ? 'Created' : 'Updated') + ' record in ' + module.sheet
  });

  invalidateDashboardCache_();

  return sanitizeRecord_(moduleKey, record);
}

function importRecords_(moduleKey, incomingRecords, sessionUser) {
  if (!incomingRecords || !incomingRecords.length) {
    throw new Error('No records to import');
  }

  var module = assertModuleAccess_(moduleKey, sessionUser.Role, 'create');
  var records = rowsToObjects_(module.sheet);
  var existingIds = {};
  var existingFixedAssetNos = {};
  var imported = [];
  var skipped = [];
  var auditEntries = [];
  var idPrefix = getIdPrefix_(moduleKey, module);
  var nextIndex = records.length + 1;

  records.forEach(function(item) {
    existingIds[String(item[module.idField] || '').trim()] = true;
    if (moduleKey === 'assets') {
      var fixedNo = normalizeFixedAssetNo_(item.FixedAssetNo);
      if (fixedNo) {
        existingFixedAssetNos[fixedNo] = true;
      }
    }
  });

  incomingRecords.forEach(function(item) {
    var record = normalizeRecordForSave_(module, item, true);
    var recordId = String(record[module.idField] || '').trim();

    if (!recordId) {
      recordId = buildSequentialId_(idPrefix, nextIndex);
      nextIndex += 1;
      record[module.idField] = recordId;
    }

    if (existingIds[recordId]) {
      throw new Error(module.idField + ' already exists: ' + recordId);
    }

    if (moduleKey === 'assets') {
      var fixedAssetNo = normalizeFixedAssetNo_(record.FixedAssetNo);
      if (fixedAssetNo && existingFixedAssetNos[fixedAssetNo]) {
        skipped.push({
          recordId: recordId,
          fixedAssetNo: record.FixedAssetNo,
          reason: 'Fixed Assets No. already exists'
        });
        return;
      }
      if (fixedAssetNo) {
        existingFixedAssetNos[fixedAssetNo] = true;
      }
    }

    if (moduleKey === 'users') {
      record.Department = record.Department || 'IT';
      record.Email = record.Email || '';
      record.Status = record.Status || 'Active';
      prepareUserPasswordFields_(record, null);
    }

    existingIds[recordId] = true;
    records.unshift(record);
    imported.push(sanitizeRecord_(moduleKey, record));
    auditEntries.push({
      action: 'CREATE',
      module: moduleKey,
      recordId: recordId,
      actorUserId: sessionUser.UserID,
      actorName: sessionUser.FullName,
      actorRole: sessionUser.Role,
      detail: 'Imported record into ' + module.sheet
    });
  });

  writeObjects_(module.sheet, records);
  writeAuditLogsBatch_(auditEntries);
  invalidateDashboardCache_();

  return {
    importedCount: imported.length,
    skippedCount: skipped.length,
    skippedRecords: skipped,
    records: imported
  };
}

function normalizeFixedAssetNo_(value) {
  return String(value || '').trim().toLowerCase();
}

function deleteStockMovementFast_(module, recordId, sessionUser) {
  var rowNumber = findRowNumberByField_(module.sheet, 'MovementID', recordId);
  if (!rowNumber) {
    throw new Error('Record not found');
  }
  var record = readObjectFromRow_(module.sheet, rowNumber);
  applyStockMovementToInventory_(record, true);
  ensureSheet_(module.sheet, SHEET_SCHEMAS[module.sheet]).deleteRow(rowNumber);
  invalidateModuleRecords_(module.sheet);
  writeAuditLog_({
    action: 'DELETE',
    module: 'stockMovements',
    recordId: recordId,
    actorUserId: sessionUser.UserID,
    actorName: sessionUser.FullName,
    actorRole: sessionUser.Role,
    detail: 'Deleted record from ' + module.sheet
  });
  invalidateDashboardCache_();
  return { deleted: true };
}

function deleteRecord_(moduleKey, recordId, sessionUser) {
  const module = assertModuleAccess_(moduleKey, sessionUser.Role, 'delete');
  if (moduleKey === 'stockMovements') {
    return deleteStockMovementFast_(module, recordId, sessionUser);
  }
  const recordToDelete = findRecordByFieldFast_(module.sheet, module.idField, recordId, true);
  if (!recordToDelete) {
    throw new Error('Record not found');
  }
  ensureSheet_(module.sheet, SHEET_SCHEMAS[module.sheet]).deleteRow(recordToDelete.__rowNumber);
  invalidateModuleRecords_(module.sheet);
  writeAuditLog_({
    action: 'DELETE',
    module: moduleKey,
    recordId: recordId,
    actorUserId: sessionUser.UserID,
    actorName: sessionUser.FullName,
    actorRole: sessionUser.Role,
    detail: 'Deleted record from ' + module.sheet
  });
  invalidateDashboardCache_();
  return { deleted: true };
}

function normalizeRecordForSave_(module, incomingRecord, isCreate) {
  const headers = SHEET_SCHEMAS[module.sheet];
  const record = {};
  headers.forEach(function(header) {
    record[header] = incomingRecord[header] != null ? incomingRecord[header] : '';
  });

  const now = getNowString_();
  record.UpdatedAt = now;

  if (isCreate && !record.CreatedAt && headers.indexOf('CreatedAt') !== -1) {
    record.CreatedAt = now;
  }

  if (module.sheet === 'StockItems') {
    applyStockStatus_(record, now);
  }

  if (incomingRecord.Password != null) {
    record.Password = incomingRecord.Password;
  }

  return normalizeDateFieldsForRecord_(record);
}

function prepareUserPasswordFields_(record, existingRecord) {
  if (record.Password && String(record.Password).trim()) {
    const salt = createSalt_();
    record.PasswordSalt = salt;
    record.PasswordHash = hashPassword_(String(record.Password), salt);
  } else if (existingRecord) {
    record.PasswordSalt = existingRecord.PasswordSalt;
    record.PasswordHash = existingRecord.PasswordHash;
  } else {
    throw new Error('Password is required for new user');
  }
  delete record.Password;
}

function getStockMovementDelta_(movement) {
  var quantity = Number(movement.Quantity || 0);
  if (!isFinite(quantity)) {
    quantity = 0;
  }

  var movementType = String(movement.MovementType || '').trim().toLowerCase();
  if (movementType === 'outbound') {
    return -Math.abs(quantity);
  }
  if (movementType === 'adjustment') {
    return quantity;
  }
  return Math.abs(quantity);
}

function applyStockStatus_(record, now) {
  var quantity = Number(record.Quantity || 0);
  var minimumStock = Number(record.MinimumStock || 0);

  if (!isFinite(quantity)) {
    quantity = 0;
  }
  if (!isFinite(minimumStock)) {
    minimumStock = 0;
  }

  record.Quantity = quantity;
  record.MinimumStock = minimumStock;
  record.LastUpdated = now;

  if (quantity <= 0) {
    record.StockStatus = 'Out of Stock';
  } else if (quantity <= minimumStock) {
    record.StockStatus = 'Low Stock';
  } else {
    record.StockStatus = 'Available';
  }
}

function applyStockMovementToInventory_(movement, reverse) {
  var itemId = String(movement.ItemID || '').trim();
  if (!itemId) {
    throw new Error('Item ID is required for stock movement');
  }

  var rowNumber = findRowNumberByField_('StockItems', 'ItemID', itemId);
  if (!rowNumber) {
    throw new Error('Inventory item not found: ' + itemId);
  }
  var stockItem = readObjectFromRow_('StockItems', rowNumber);

  var delta = getStockMovementDelta_(movement);
  if (reverse) {
    delta = delta * -1;
  }

  var currentQuantity = Number(stockItem.Quantity || 0);
  if (!isFinite(currentQuantity)) {
    currentQuantity = 0;
  }

  var nextQuantity = currentQuantity + delta;
  if (nextQuantity < 0) {
    throw new Error('Stock cannot be negative for item ' + itemId);
  }

  stockItem.Quantity = nextQuantity;
  applyStockStatus_(stockItem, getNowString_());
  writeObjectToRow_('StockItems', rowNumber, stockItem);
}

function applyRoleScope_(moduleKey, records, sessionUser) {
  if (normalizeRole_(sessionUser.Role) === 'admin') {
    return records;
  }

  if (moduleKey === 'tickets') {
    return records.filter(function(item) {
      return item.Requester === sessionUser.FullName || item.Requester === sessionUser.Username;
    });
  }

  if (moduleKey === 'accessRequests') {
    return records.filter(function(item) {
      return item.Requester === sessionUser.FullName || item.Requester === sessionUser.Username;
    });
  }

  return records;
}

function readModuleRowsBatch_(moduleKeys) {
  if (typeof Sheets === 'undefined') {
    return null;
  }
  var response = Sheets.Spreadsheets.Values.batchGet(getSpreadsheet_().getId(), {
    ranges: moduleKeys.map(function(key) { return "'" + MODULES[key].sheet + "'"; }),
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'SERIAL_NUMBER'
  });
  var recordsByModule = {};
  moduleKeys.forEach(function(key, index) {
    var values = ((response.valueRanges || [])[index] || {}).values || [];
    var headers = values[0] || [];
    recordsByModule[key] = values.slice(1)
      .filter(function(row) { return row.some(function(cell) { return cell !== '' && cell != null; }); })
      .map(function(row) {
        var record = {};
        headers.forEach(function(header, column) {
          if (!header) return;
          var value = row[column] == null ? '' : row[column];
          if (typeof value === 'number' && ['DateOfDepreciation', 'MovementDate', 'EndDate', 'StartDate', 'ExpiryDate', 'RequestDate'].indexOf(header) !== -1) {
            value = new Date(Date.UTC(1899, 11, 30) + Math.floor(value) * 86400000).toISOString().slice(0, 10);
          }
          record[header] = value;
        });
        return record;
      });
  });
  return recordsByModule;
}

function getScopedBatchModuleRows_(recordsByModule, moduleKey, sessionUser) {
  return applyRoleScope_(moduleKey, recordsByModule[moduleKey] || [], sessionUser)
    .map(function(record) {
      if (moduleKey === 'maintenanceAgreements') record.Status = getMaintenanceAgreementStatus_(record);
      return sanitizeRecord_(moduleKey, record);
    });
}

function sidebarAlerts_(sessionUser) {
  var cache = CacheService.getScriptCache();
  var version = PropertiesService.getScriptProperties().getProperty('DASHBOARD_CACHE_VERSION') || '0';
  var scope = normalizeRole_(sessionUser.Role) === 'admin'
    ? 'admin' : String(sessionUser.UserID || sessionUser.Username || 'anonymous');
  var cacheKey = 'sidebar-alerts:v3:' + version + ':' + scope;
  var cached = cache.get(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (error) {
    }
  }

  var batchRows = null;
  try {
    batchRows = readModuleRowsBatch_(['assets', 'stockItems', 'accessRequests', 'maintenanceAgreements']);
  } catch (error) {
    console.warn('Sidebar alert batch read failed; using cached module reads. ' + error.message);
  }
  var assets = batchRows ? getScopedBatchModuleRows_(batchRows, 'assets', sessionUser) : safeListRecordsForDashboard_('assets', sessionUser);
  var stockItems = batchRows ? getScopedBatchModuleRows_(batchRows, 'stockItems', sessionUser) : safeListRecordsForDashboard_('stockItems', sessionUser);
  var accessRequests = batchRows ? getScopedBatchModuleRows_(batchRows, 'accessRequests', sessionUser) : safeListRecordsForDashboard_('accessRequests', sessionUser);
  var maintenanceAgreements = batchRows ? getScopedBatchModuleRows_(batchRows, 'maintenanceAgreements', sessionUser) : safeListRecordsForDashboard_('maintenanceAgreements', sessionUser);
  var result = {
    expiringSoonAssets: 0,
    expiredAssets: 0,
    pendingAccessRequests: accessRequests.filter(function(item) {
      return String(item.Status || '') === 'Pending Approval';
    }).length,
    lowStock: stockItems.filter(function(item) { return item.StockStatus === 'Low Stock'; }).length,
    outOfStock: stockItems.filter(function(item) { return item.StockStatus === 'Out of Stock'; }).length,
    maintenanceExpiring: maintenanceAgreements.filter(function(item) { return item.Status === 'Expiring'; }).length,
    maintenanceExpired: maintenanceAgreements.filter(function(item) { return item.Status === 'Expired'; }).length
  };

  assets.forEach(function(item) {
    var assetAgeMonths = getAssetAgeMonthsFromDateValue_(item.DateOfDepreciation);
    var lifeTimeMonths = getLifeTimeMonths_(item.LifeTime);
    if (lifeTimeMonths < 0 || assetAgeMonths < 0) {
      return;
    }
    if (assetAgeMonths > lifeTimeMonths) {
      result.expiredAssets += 1;
    }
    if ((lifeTimeMonths - assetAgeMonths) >= 0 && (lifeTimeMonths - assetAgeMonths) <= 6) {
      result.expiringSoonAssets += 1;
    }
  });
  cache.put(cacheKey, JSON.stringify(result), SIDEBAR_ALERTS_CACHE_TTL_SECONDS);
  return result;
}

function loadDashboardRows_(sessionUser) {
  var modules = ['assets', 'tickets', 'accessRequests', 'stockItems', 'stockMovements', 'licenses', 'maintenanceAgreements']
    .filter(function(key) {
      return MODULES[key].roles.some(function(role) { return normalizeRole_(role) === normalizeRole_(sessionUser.Role); });
    });
  var startedAt = Date.now();
  if (typeof Sheets === 'undefined') {
    console.warn('Dashboard batch read unavailable: enable the Sheets v4 advanced service.');
    return;
  }
  // Read actual header names, never assume the order of columns in older sheets.
  // Serial dates avoid dependence on each cell's display format and locale.
  EXECUTION_DASHBOARD_ROWS_ = readModuleRowsBatch_(modules);
  console.log(JSON.stringify({ event: 'dashboard_read', mode: 'batch', durationMs: Date.now() - startedAt, sheets: modules.length }));
}

function dashboardSummary_(sessionUser) {
  var cache = CacheService.getScriptCache();
  var cacheKey = getDashboardCacheKey_(sessionUser);
  var cachedSummary = cache.get(cacheKey);
  if (cachedSummary) {
    try {
      return JSON.parse(cachedSummary);
    } catch (error) {
    }
  }

  loadDashboardRows_(sessionUser);
  const assets = safeListRecordsForDashboard_('assets', sessionUser);
  const tickets = safeListRecordsForDashboard_('tickets', sessionUser);
  const accessRequests = safeListRecordsForDashboard_('accessRequests', sessionUser);
  const stockItems = safeListRecordsForDashboard_('stockItems', sessionUser);
  const stockMovements = safeListRecordsForDashboard_('stockMovements', sessionUser);
  const licenses = safeListRecordsForDashboard_('licenses', sessionUser);
  const maintenanceAgreements = safeListRecordsForDashboard_('maintenanceAgreements', sessionUser);
  const lowStockItems = stockItems.filter(function(item) { return item.StockStatus === 'Low Stock'; });
  const outOfStockItems = stockItems.filter(function(item) { return item.StockStatus === 'Out of Stock'; });
  const availableStockItems = stockItems.filter(function(item) { return item.StockStatus === 'Available'; });
  const assetStatusSummary = assets.reduce(function(summary, item) {
    const assetAgeMonths = getAssetAgeMonthsFromDateValue_(item.DateOfDepreciation);
    const lifeTimeMonths = getLifeTimeMonths_(item.LifeTime);
    const amountBaht = Number(item.AmountBaht || 0);

    summary.totalAssetRecords += 1;
    if (isFinite(amountBaht)) {
      summary.totalAssetValue += amountBaht;
    }

    if (lifeTimeMonths < 0 || assetAgeMonths < 0) {
      summary.unknownLifetimeAssets += 1;
      return summary;
    }

    if (assetAgeMonths > lifeTimeMonths) {
      summary.expiredAssets += 1;
    } else {
      summary.normalAssets += 1;
    }

    if ((lifeTimeMonths - assetAgeMonths) >= 0 && (lifeTimeMonths - assetAgeMonths) <= 6) {
      summary.expiringSoonAssets += 1;
    }

    return summary;
  }, {
    totalAssetRecords: 0,
    normalAssets: 0,
    expiredAssets: 0,
    expiringSoonAssets: 0,
    unknownLifetimeAssets: 0,
    totalAssetValue: 0
  });
  const stockCategories = {};
  stockItems.forEach(function(item) {
    var category = String(item.Category || '').trim();
    if (category) {
      stockCategories[category] = true;
    }
  });
  const assetLifecycleGroups = {};
  assets.forEach(function(item) {
    var groupName = String(item.Group || 'Unassigned').trim() || 'Unassigned';
    if (!assetLifecycleGroups[groupName]) {
      assetLifecycleGroups[groupName] = { group: groupName, normal: 0, expiringSoon: 0, expired: 0, unknown: 0 };
    }
    var assetAgeMonths = getAssetAgeMonthsFromDateValue_(item.DateOfDepreciation);
    var lifeTimeMonths = getLifeTimeMonths_(item.LifeTime);
    if (lifeTimeMonths < 0 || assetAgeMonths < 0) {
      assetLifecycleGroups[groupName].unknown += 1;
    } else if (assetAgeMonths > lifeTimeMonths) {
      assetLifecycleGroups[groupName].expired += 1;
    } else if ((lifeTimeMonths - assetAgeMonths) <= 6) {
      assetLifecycleGroups[groupName].expiringSoon += 1;
    } else {
      assetLifecycleGroups[groupName].normal += 1;
    }
  });
  const assetLifecycleByGroup = Object.keys(assetLifecycleGroups)
    .sort(function(left, right) {
      var order = { Computer: 1, Software: 2, 'Office Equiment': 3, 'Office Equipment': 3, Unassigned: 9 };
      return (order[left] || 8) - (order[right] || 8) || left.localeCompare(right);
    })
    .map(function(groupName) { return assetLifecycleGroups[groupName]; });
  const stockMovementTrendMap = {};
  const stockMovementTrend = [];
  const today = new Date();
  for (var monthOffset = 5; monthOffset >= 0; monthOffset -= 1) {
    var monthDate = new Date(today.getFullYear(), today.getMonth() - monthOffset, 1);
    var monthKey = Utilities.formatDate(monthDate, APP_TIME_ZONE, 'yyyy-MM');
    var monthLabel = Utilities.formatDate(monthDate, APP_TIME_ZONE, 'MMM yyyy');
    stockMovementTrendMap[monthKey] = { month: monthKey, label: monthLabel, inbound: 0, outbound: 0 };
    stockMovementTrend.push(stockMovementTrendMap[monthKey]);
  }
  stockMovements.forEach(function(movement) {
    var movementDate = normalizeDateFieldValue_(movement.MovementDate);
    var monthKey = movementDate.slice(0, 7);
    var trendItem = stockMovementTrendMap[monthKey];
    if (!trendItem) {
      return;
    }
    var quantity = Math.abs(Number(movement.Quantity || 0));
    if (!isFinite(quantity)) {
      return;
    }
    if (String(movement.MovementType || '').toLowerCase() === 'outbound') {
      trendItem.outbound += quantity;
    } else if (String(movement.MovementType || '').toLowerCase() === 'inbound') {
      trendItem.inbound += quantity;
    }
  });

  var summary = {
    totalAssets: assetStatusSummary.totalAssetRecords,
    activeAssets: assetStatusSummary.normalAssets,
    expiredAssets: assetStatusSummary.expiredAssets,
    expiringSoonAssets: assetStatusSummary.expiringSoonAssets,
    unknownLifetimeAssets: assetStatusSummary.unknownLifetimeAssets,
    totalAssetValue: assetStatusSummary.totalAssetValue,
    repairAssets: 0,
    warrantyExpiring: assetStatusSummary.expiringSoonAssets,
    openTickets: tickets.filter(function(item) { return ['Resolved', 'Closed', 'Rejected'].indexOf(item.Status) === -1; }).length,
    pendingApproval: tickets.filter(function(item) { return item.ApprovalStatus === 'Pending Approval'; }).length + accessRequests.filter(function(item) { return item.Status === 'Pending Approval'; }).length,
    pendingAccessRequests: accessRequests.filter(function(item) { return item.Status === 'Pending Approval'; }).length,
    totalStockItems: stockItems.length,
    availableStockItems: availableStockItems.length,
    lowStock: lowStockItems.length,
    outOfStock: outOfStockItems.length,
    totalStockUnits: stockItems.reduce(function(total, item) { return total + Number(item.Quantity || 0); }, 0),
    stockCategories: Object.keys(stockCategories).length,
    assetLifecycleByGroup: assetLifecycleByGroup,
    stockMovementTrend: stockMovementTrend,
    licenseExpiring: licenses.filter(function(item) { return item.Status === 'Expiring' || item.Status === 'Expired'; }).length,
    maintenanceExpiring: maintenanceAgreements.filter(function(item) { return item.Status === 'Expiring'; }).length,
    maintenanceExpired: maintenanceAgreements.filter(function(item) { return item.Status === 'Expired'; }).length,
    lowStockItems: lowStockItems.slice(0, 5),
    expiredAssetItems: assets.filter(function(item) {
      var assetAgeMonths = getAssetAgeMonthsFromDateValue_(item.DateOfDepreciation);
      var lifeTimeMonths = getLifeTimeMonths_(item.LifeTime);
      return lifeTimeMonths >= 0 && assetAgeMonths > lifeTimeMonths;
    }).slice(0, 5)
  };
  cache.put(cacheKey, JSON.stringify(summary), 300);
  return summary;
}

function safeListRecordsForDashboard_(moduleKey, sessionUser) {
  if (EXECUTION_DASHBOARD_ROWS_) {
    return applyRoleScope_(moduleKey, EXECUTION_DASHBOARD_ROWS_[moduleKey] || [], sessionUser)
      .map(function(record) {
        if (moduleKey === 'maintenanceAgreements') record.Status = getMaintenanceAgreementStatus_(record);
        return sanitizeRecord_(moduleKey, record);
      });
  }
  try {
    return listRecords_(moduleKey, sessionUser);
  } catch (error) {
    return [];
  }
}

function doGet(e) {
  var startedAt = new Date().getTime();
  const params = parseRequestBody_(e);
  const action = params.action || 'health';

  try {
    if (action === 'health') {
      return makeJsonResponse_({
        success: true,
        data: {
          appName: APP_NAME,
          buildVersion: APP_BUILD_VERSION,
          timestamp: getNowString_(),
          spreadsheetName: getSpreadsheet_().getName()
        }
      });
    }

    return makeJsonResponse_({ success: false, message: 'Unsupported GET action' });
  } catch (error) {
    return makeJsonResponse_({ success: false, message: error.message });
  } finally {
    logApiTiming_(action, startedAt);
  }
}

function doPost(e) {
  var startedAt = new Date().getTime();
  const params = parseRequestBody_(e);
  const action = params.action;

  try {
    if (!action) {
      throw new Error('Action is required');
    }

    if (action === 'login') {
      return makeJsonResponse_({ success: true, data: login_(params) });
    }

    if (action === 'register') {
      return makeJsonResponse_({ success: true, data: withWriteLock_(function() { return register_(params); }) });
    }

    if (action === 'logout') {
      return makeJsonResponse_({ success: true, data: withWriteLock_(function() { return logout_(params.token); }) });
    }

    if (action === 'createPublicTicket') {
      const validatedTicketUser = validateSession_(params.token);
      return makeJsonResponse_({ success: true, data: createPublicTicket_(params, validatedTicketUser.user) });
    }

    if (action === 'createUserRequest') {
      return makeJsonResponse_({ success: true, data: createUserRequest_(params) });
    }

    if (action === 'listPublicInventoryItems') {
      return makeJsonResponse_({ success: true, data: { records: listPublicInventoryItems_() } });
    }

    if (action === 'listPublicTicketJobs') {
      return makeJsonResponse_({ success: true, data: { records: listPublicTicketJobs_() } });
    }

    if (action === 'getPublicTicketWorkspace') {
      return makeJsonResponse_({ success: true, data: getPublicTicketWorkspace_() });
    }

    if (action === 'getPublicTicketJobSummary') {
      return makeJsonResponse_({ success: true, data: getPublicTicketJobSummary_() });
    }

    if (action === 'checkSession') {
      try {
        const validatedCheck = validateSession_(params.token);
        return makeJsonResponse_({
          success: true,
          data: {
            valid: true,
            token: validatedCheck.session.Token,
            expiresAt: validatedCheck.session.ExpiresAt,
            user: validatedCheck.user
          }
        });
      } catch (error) {
        return makeJsonResponse_({
          success: true,
          data: { valid: false }
        });
      }
    }

    const validated = validateSession_(params.token);

    if (action === 'recordLoginActivity') {
      return makeJsonResponse_({ success: true, data: recordLoginActivity_(validated.user) });
    }

    if (action === 'dashboardSummary') {
      return makeJsonResponse_({ success: true, data: dashboardSummary_(validated.user) });
    }

    if (action === 'sidebarAlerts') {
      return makeJsonResponse_({ success: true, data: sidebarAlerts_(validated.user) });
    }

    if (action === 'listKnowledgeCategories') {
      return makeJsonResponse_({ success: true, data: { categories: listKnowledgeCategories_(validated.user) } });
    }

    if (action === 'createKnowledgeCategory') {
      return makeJsonResponse_({ success: true, data: { categories: withWriteLock_(function() { return createKnowledgeCategory_(params.name, validated.user); }) } });
    }

    if (action === 'renameKnowledgeCategory') {
      return makeJsonResponse_({
        success: true,
        data: withWriteLock_(function() {
          return renameKnowledgeCategory_(params.previousName, params.nextName, validated.user);
        })
      });
    }

    if (action === 'deleteKnowledgeCategory') {
      return makeJsonResponse_({
        success: true,
        data: withWriteLock_(function() {
          return deleteKnowledgeCategory_(params.name, params.confirmation, parsePossibleJson_(params.documentIds), validated.user);
        })
      });
    }

    if (action === 'saveKnowledgeDocument') {
      return makeJsonResponse_({
        success: true,
        data: {
          record: saveKnowledgeDocument_(parsePossibleJson_(params.record), parsePossibleJson_(params.file), validated.user, String(params.mode || 'create') === 'create')
        }
      });
    }

    if (action === 'getTicketSignatures') {
      return makeJsonResponse_({
        success: true,
        data: getTicketSignatures_(params, validated.user)
      });
    }

    if (action === 'getKnowledgePreviewData') {
      return makeJsonResponse_({
        success: true,
        data: getKnowledgePreviewData_(params.documentId, validated.user)
      });
    }

    if (action === 'getTicketRecord') {
      return makeJsonResponse_({
        success: true,
        data: { record: getTicketRecord_(params.ticketId, validated.user) }
      });
    }

    if (action === 'resolveTicket') {
      return makeJsonResponse_({
        success: true,
        data: { record: resolveTicket_(params, validated.user) }
      });
    }

    if (action === 'listRecords') {
      return makeJsonResponse_({ success: true, data: { records: listRecords_(params.module, validated.user) } });
    }

    if (action === 'listTicketWorkspace') {
      return makeJsonResponse_({ success: true, data: { records: listRecords_('tickets', validated.user) } });
    }

    if (action === 'searchAssets') {
      return makeJsonResponse_({ success: true, data: { records: searchAssets_(params.query, validated.user) } });
    }

    if (action === 'renewMaintenanceAgreement') {
      return makeJsonResponse_({
        success: true,
        data: renewMaintenanceAgreement_(params.agreementId, parsePossibleJson_(params.renewal), parsePossibleJson_(params.file), validated.user)
      });
    }

    if (action === 'listAssetAssignmentHistory') {
      return makeJsonResponse_({ success: true, data: { records: listAssetAssignmentHistory_(params.assetId, validated.user) } });
    }

    if (action === 'listComputerBorrowings') {
      return makeJsonResponse_({ success: true, data: { records: listComputerBorrowings_(params.assetId, validated.user) } });
    }

    if (action === 'createComputerBorrowing') {
      return makeJsonResponse_({ success: true, data: { record: saveComputerBorrowing_(params, validated.user) } });
    }

    if (action === 'createComputerReturn') {
      return makeJsonResponse_({ success: true, data: { record: createComputerReturn_(params, validated.user) } });
    }

    if (action === 'returnComputerBorrowing') {
      return makeJsonResponse_({ success: true, data: { record: returnComputerBorrowing_(params, validated.user) } });
    }

    if (action === 'getComputerBorrowingPdfData') {
      return makeJsonResponse_({ success: true, data: getComputerBorrowingPdfData_(params.borrowingId, validated.user) });
    }

    if (action === 'createRecord') {
      return makeJsonResponse_({
        success: true,
        data: {
          record: withWriteLock_(function() { return saveRecord_(params.module, parsePossibleJson_(params.record), validated.user, true); })
        }
      });
    }

    if (action === 'saveRecord') {
      return makeJsonResponse_({
        success: true,
        data: {
          record: withWriteLock_(function() { return saveRecord_(params.module, parsePossibleJson_(params.record), validated.user, false); })
        }
      });
    }

    if (action === 'deleteRecord') {
      return makeJsonResponse_({
        success: true,
        data: withWriteLock_(function() { return deleteRecord_(params.module, params.recordId, validated.user); })
      });
    }

    if (action === 'importRecords') {
      return makeJsonResponse_({
        success: true,
        data: withWriteLock_(function() { return importRecords_(params.module, parsePossibleJson_(params.records), validated.user); })
      });
    }

    return makeJsonResponse_({ success: false, message: 'Unsupported action' });
  } catch (error) {
    return makeJsonResponse_({ success: false, message: error.message });
  } finally {
    logApiTiming_(action, startedAt);
  }
}

function initializeSystem() {
  return withWriteLock_(function() {
    bootstrapSchema();
    return {
      appName: APP_NAME,
      message: 'System schema initialized'
    };
  });
}
