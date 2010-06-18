/**
 * Constructor for direct message view
 */
StatusNet.DirectMessageView = function() {
    var db = StatusNet.getDB();
    this.account = StatusNet.Account.getDefault(db);

    StatusNet.debug("DirectMessageView constructor");
}

/**
 * Initialize the window
 */
StatusNet.DirectMessageView.prototype.init = function() {
    // post a new notice
    StatusNet.debug("DirectMessageView.init()");

    var that = this;
    var me = Titanium.UI.getCurrentWindow();

    $('#send_button').bind('click', function(event) {
        that.send();
    });

    var textLimit = this.account.textLimit;

    StatusNet.debug("textlimit = " + textLimit);

    // Note: backspace and other whitespace keys don't generate
    // a keypress event on linux, although they do on OS X.
    $('#counter').html(that.account.textLimit);
    $('#direct_message_textarea').bind('keydown', function(event) {
        var len = $('#direct_message_textarea').val().length;

        // turn char counter red when it goes negative
        if (textLimit - len < 0 && (textLimit - len) + 1 === 0) {
            $('#counter').addClass('negative');
        }

        if (textLimit - len === 0) {
            $('#counter').removeClass('negative');
        }

        $('#counter').html(textLimit - len);
    });
}

/**
 * Send direct message
 */
StatusNet.DirectMessageView.prototype.send = function()
{
    StatusNet.debug("DirectMessageView.send()");
    var that = this;
    var url = 'direct_messages/new.json';
    var msgText = $('#direct_message_textarea').val();

    var me = Titanium.UI.getCurrentWindow();

    var params = 'text='
        + encodeURIComponent(msgText)
        + "&screen_name="
        + encodeURIComponent(me.nickname);

    this.account.postUrl(url, params,
        function(status, data) {
            StatusNet.debug(data);
            StatusNet.debug(data.user);
            me.close();
        },
        function(client, responseText) {
            var msg = Titanium.JSON.parse(responseText);
            StatusNet.debug('Error: ' + msg.error);
            alert('Error: ' + msg.error);
            me.close();
        }
    );
}
