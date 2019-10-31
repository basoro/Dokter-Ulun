<form method="post">
  <?php
  if (isset($_POST['ok_catatan'])) {
    if (($_POST['catatan_dokter'] <> "") and ($no_rawat <> "")) { 

           $insert = query("INSERT INTO catatan_perawatan VALUES (CURRENT_DATE(), CURRENT_TIME(), '{$no_rawat}', '{$_SESSION['username']}', '{$_POST['catatan_dokter']}')");
           if ($insert) {
                redirect("{$_SERVER['PHP_SELF']}?action=view&no_rawat={$no_rawat}");
           }
    }
  }

  ?>
<div class="row clearfix">
    <div class="col-sm-12">
        <div class="form-group">
            <div class="form-line">
                <textarea rows="8" name="catatan_dokter" class="form-control no-resize" placeholder="Tulis catatan dokter disini..."></textarea>
            </div>
        </div>
    </div>
    <div class="col-sm-12">
        <div class="form-group">
			<button type="submit" name="ok_catatan" value="ok_catatan" class="btn bg-indigo waves-effect" onclick="this.value=\'ok_catatan\'">SIMPAN</button>
        </div>
    </div>
</div>
</form>

<dl class="dl-horizontal">
  <dt>Catatan Perawatan</dt>
    <dd>
      <ul style="list-style:none;margin-left:0;padding-left:0;">
        <?php
        $query = query("SELECT * FROM catatan_perawatan WHERE no_rawat = '{$no_rawat}'");
        while ($data = fetch_array($query)) {
        ?>
                  <li><?php echo nl2br($data['4']); ?> <a class="btn btn-danger btn-xs" href="<?php $_SERVER['PHP_SELF']; ?>?action=delete_catatan&no_rawat=<?php echo $data['2']; ?>">[X]</a></li>
        <?php
        }
        ?>
      </ul>
    </dd>
</dl>
