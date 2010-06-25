/**
 * Constructor for base timeline model class
 *
 * @param StatusNet.Client       client the controller
 * @param StatusNet.TimelineView view   the view
 */
StatusNet.Timeline = function(client) {

    this.client = client;
    this.account = this.client.account;
    this.db = StatusNet.getDB();

    this._notices = [];

    this.noticeAdded = new StatusNet.Event(this);
    this.updateStart = new StatusNet.Event(this);
    this.updateFinished = new StatusNet.Event(this);
}

/**
 * Add a notice (Atom entry) to the cache
 *
 * @param string timeline_name  name of the timeline
 * @param int    noticeId       ID of the notice
 * @param DOM    entry          XML Atom entry for the notice
 */
StatusNet.Timeline.prototype.encacheNotice = function(noticeId, entry) {

    StatusNet.debug("Timeline.encacheNotice() - encaching notice:" + noticeId + ", timeline= " + this.timeline_name + ", account=" + this.client.account.id);

    rc = this.db.execute(
        "INSERT OR REPLACE INTO entry (notice_id, atom_entry) VALUES (?, ?)",
        noticeId,
        (new XMLSerializer()).serializeToString(entry)
    );

    rc = this.db.execute(
        "INSERT OR REPLACE INTO notice_entry (account_id, notice_id, timeline, timestamp) VALUES (?, ?, ?, ?)",
        this.client.account.id,
        noticeId,
        this.timeline_name,
        Date.now()
    );

    // @todo Check for an error condition -- how?
}

/**
 * Remove a notice (Atom entry) from the cache (all timelines)
 *
 * @param int noticeId  the ID of the notice to decache
 */
StatusNet.Timeline.prototype.decacheNotice = function(noticeId) {

    StatusNet.debug("Timeline.decacheNotice() - decaching notice:" + noticeId + ", timeline= " + this.timeline_name + ", account=" + this.client.account.id);

    rc = this.db.execute(
        "DELETE FROM notice_entry WHERE account_id = ? AND notice_id = ?",
            this.client.account.id,
            noticeId);

    rc = this.db.execute(
        "DELETE FROM entry WHERE notice_id = ?",
        noticeId
    );

    // @todo Check for an error condition -- how?
}

/**
 * Refresh the cache for a single notice (Atom entry)
 *
 * @param int noticeId  the Id of the notice to refresh
 */
StatusNet.Timeline.prototype.refreshNotice = function(noticeId) {

    StatusNet.debug('Timeline.refreshNotice() - refreshing notice ' + noticeId);

    // XXX: For now, always take this from the public timeline
    var noticeUrl = 'statuses/friends_timeline.atom' + '?max_id=' + noticeId + '&count=1';

    var that = this;

    this.account.fetchUrl(noticeUrl,
        function(status, data) {
            StatusNet.debug('Fetched ' + that.noticeUrl);

            var entry = $(data).find('feed > entry:first').get(0);

            if (entry && that.cacheable()) {
                that.encacheNotice(noticeId, entry);
                StatusNet.debug('Timeline.refreshNotice(): found an entry.');
            }

        },
        function(client, msg) {
            StatusNet.debug("Something went wrong refreshing notice " + noticeId + ": " + msg);
            StatusNet.Infobar.flashMessage("Could not refresh notice " + noticeId +": " + msg);
        }
    );
}

/**
 * Add a notice to the Timeline if it's not already in it. Also
 * adds it to the notice cache.
 *
 * @param DOM     entry              the Atom entry form of the notice
 * @param boolean prepend            whether to add it to the beginning of end of
 *
 */
StatusNet.Timeline.prototype.addNotice = function(entry, prepend) {

    var notice = StatusNet.AtomParser.noticeFromEntry(entry);

    // Dedupe here?
    for (i = 0; i < this._notices.length; i++) {
        if (this._notices[i].id === notices.id) {
            StatusNet.debug("skipping duplicate notice: " + notice.id);
            return;
        }
    }

    if (notice.id !== undefined) {
        if (this.cacheable()) {
            StatusNet.debug("encached notice: " + notice.id);
            this.encacheNotice(notice.id, entry);
        }
    }

    StatusNet.debug("addNotice - finished encaching notice")

    if (prepend) {
        this._notices.unshift(notice);
        this.noticeAdded.notify({notice: notice});
        StatusNet.debug("StatusNet.Timeline.addNotice - finished prepending notice");
    } else {
        this._notices.push(notice);
    }
}

/**
 * Update the timeline.  Does a fetch of the Atom feed for the appropriate
 * timeline and notifies the view the model has changed.
 */
StatusNet.Timeline.prototype.update = function(onFinish) {

    StatusNet.debug("update() onFinish = " + onFinish);

    this.updateStart.notify();

    StatusNet.debug("Notified view that we're doing an update");

    var that = this;

    this.account.fetchUrl(this.getUrl(),

        function(status, data) {

            StatusNet.debug('Fetched ' + that.getUrl());
            StatusNet.debug('HTTP client returned: ' + (new XMLSerializer()).serializeToString(data));

            var entries = [];

            $(data).find('feed > entry').each(function() {
                StatusNet.debug('Timeline.update: found an entry.');
                entries.push(this);
            });

            entries.reverse(); // keep correct notice order

            for (var i = 0; i < entries.length; i++) {
                that.addNotice(entries[i], true);
            }

            that.updateFinished.notify({notice_count: entries.length});

            if (onFinish) {
                onFinish(entries.length);
            }
            that.finishedFetch(entries.length)
        },
        function(client, msg) {
            StatusNet.debug("Something went wrong retrieving timeline: " + msg);
            StatusNet.Infobar.flashMessage("Couldn't get timeline: " + msg);
        }
    );

}

/**
 * Get the URL for the Atom feed of this timeline
 */
StatusNet.Timeline.prototype.getUrl = function() {

    // @fixme use the current account instead of the default
    var ac = StatusNet.Account.getDefault(this.db);

    var sql = 'SELECT MAX (notice_id) AS last_id FROM notice_entry WHERE account_id = ? AND timeline = ?';
    rs = this.db.execute(sql, ac.id, this.timeline_name);

    StatusNet.debug("account = " + ac.id + ", timeline_name = " + this.timeline_name);

    var lastId = 0;

    if (rs.isValidRow()) {
        lastId = rs.fieldByName('last_id');
    }

    StatusNet.debug("lastId = " + lastId);

    if (lastId > 0) {
        return this._url + '?since_id=' + lastId;
    } else {
        return this._url;
    }
}

/**
 * Trim the notice cache for this timeline.  Hard limit of 200 notices per
 * timeline, and trim anything older than 72 hours.
 *
 * @todo Don't trim the cache if we're offline.
 */
StatusNet.Timeline.prototype.trimNotices = function() {

    // Remove notices older than 72 hours from cache
    // @todo Make cache window configurable and tune the defaults

    // NOTE: I'm using integer timestamps because Titanium seems to blow up when
    // using SQLite's date functions :(

    var now = new Date();
    var cutoff = new Date();
    cutoff.setTime(now.getTime() - (86400 * 3 * 1000));

    StatusNet.debug(
        "Clearing out old cache entries for timeline "
        + this.timeline_name
        + " (NOW = "
        + now.getTime()
        + ", CUTOFF = "
        + cutoff.getTime()
        + ")"
    );

    var rs = this.db.execute(
        "DELETE FROM entry WHERE notice_id IN "
        + "(SELECT notice_id FROM notice_entry WHERE timestamp < ? AND timeline = ? AND account_id = ?)",
        cutoff.getTime(),
        this.timeline_name,
        this.account.id
    );

    rs = this.db.execute(
        'DELETE FROM notice_entry WHERE timestamp < ? AND timeline = ? AND account_id = ?',
        cutoff.getTime(),
        this.timeline_name,
        this.account.id
    );

    // Also keep an absolute maximum of 200 notices per timeline

    rs = this.db.execute(
        "SELECT count(*) FROM notice_entry WHERE timeline = ? AND account_id = ?",
        this.timeline_name,
        this.account.id
    );

    if (rs.isValidRow()) {

        var count = rs.fieldByName("count(*)");

        StatusNet.debug("COUNT = " + count);

        if (count > 200) {

            var diff = (count - 200);

            StatusNet.debug("Row count for " + this.timeline_name + " = " + count + ", overflow = " + diff);

            var sql = "DELETE FROM entry WHERE notice_id IN "
                + "(SELECT notice_id FROM notice_entry WHERE timeline = ? AND account_id = ? ORDER BY timestamp ASC LIMIT ?)";

            rs = this.db.execute(sql,
                this.timeline_name,
                this.account.id,
                diff
            );

            rs = this.db.execute(
                "DELETE FROM notice_entry WHERE notice_id IN "
                + "(SELECT notice_id FROM notice_entry WHERE timeline = ? AND account_id = ? ORDER BY timestamp ASC LIMIT ?)",
                this.timeline_name,
                this.account.id,
                diff
            );
        }
    }
}

/**
 * Whether to cache this timeline - may be overrided by timelines
 * we can't or don't want to cache ATM
 */
StatusNet.Timeline.prototype.cacheable = function() {
    return true;
}

/**
 * Do anything that needs doing after retrieving timeline data.
 */
StatusNet.Timeline.prototype.finishedFetch = function(notice_count) {

    if (this._notices.length === 0) {
        StatusNet.debug("Show empty timeline msg");
        this.client.getActiveView().showEmptyTimeline();
    }

    if (this.cacheable()) {
        this.trimNotices();
    }
}

/**
 * Accessor for notices
 *
 * @return Array an array of notices
 */
StatusNet.Timeline.prototype.getNotices = function() {

    StatusNet.debug("Account ID = " + this.account.id);
    StatusNet.debug("Timeline name = " + this.timeline_name);

    var sql = "SELECT * FROM notice_entry JOIN entry ON notice_entry.notice_id = entry.notice_id "
        + "WHERE notice_entry.account_id = ? AND notice_entry.timeline = ? ORDER BY notice_entry.notice_id";

    var rs = this.db.execute(sql,
        this.account.id,
        this.timeline_name
    );

    while (rs.isValidRow()) {
        StatusNet.debug("Valid row found");
        xmlEntry = rs.fieldByName('atom_entry');
        entry = (new DOMParser()).parseFromString(xmlEntry, "text/xml");
        var notice = StatusNet.AtomParser.noticeFromEntry(entry);
        this._notices.unshift(notice);
        rs.next();
    }
    rs.close();

    return this._notices;
}

/**
 * Constructor for mentions timeline model
 */
StatusNet.TimelineMentions = function(client) {
    StatusNet.Timeline.call(this, client);

    this.timeline_name = 'mentions';

    this._url = 'statuses/mentions.atom';

}

// Make StatusNet.TimelineMentions inherit Timeline's prototype
StatusNet.TimelineMentions.prototype = heir(StatusNet.Timeline.prototype);

/**
 * Constructor for public timeline model
 */
StatusNet.TimelinePublic = function(client) {
    StatusNet.Timeline.call(this, client);

    this.timeline_name = 'public';

    this._url = 'statuses/public_timeline.atom';

}

// Make StatusNet.TimelinePublic inherit Timeline's prototype
StatusNet.TimelinePublic.prototype = heir(StatusNet.Timeline.prototype);

/**
 * Constructor for favorites timeline model
 */
StatusNet.TimelineFavorites = function(client) {
    StatusNet.Timeline.call(this, client);

    this.timeline_name = 'favorites';

    this._url = 'favorites.atom';

}

// Make StatusNet.TimelineFavorites inherit Timeline's prototype
StatusNet.TimelineFavorites.prototype = heir(StatusNet.Timeline.prototype);

/**
 * Constructor for tag timeline model
 */
StatusNet.TimelineTag = function(client, tag) {
    StatusNet.Timeline.call(this, client);

    StatusNet.debug("TimelineTag constructor - tag = " + tag);

    this._url = 'statusnet/tags/timeline/' + tag + '.atom';

    this.tag = tag;
    this.timeline_name = 'tag-' + this.tag;

    StatusNet.debug("TimelineTag constructor - timeline name: " + this.timeline_name);

    StatusNet.debug("Tag timeline URL = " + this._url);
}

// Make StatusNet.TimelineTag inherit Timeline's prototype
StatusNet.TimelineTag.prototype = heir(StatusNet.Timeline.prototype);

// XXX: Turns out StatusNet's TAG timeline doesn't respect the since_id so
// until we fix it, I'm going to disable caching of tag timelines --Z 
StatusNet.TimelineTag.prototype.cacheable = function() {
    return false;
}
