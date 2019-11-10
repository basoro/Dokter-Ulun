<form method="post">
  <?php
  if (isset($_POST['ok_rujuk'])) {
    if (($_POST['konsul'] <> "") and ($no_rawat <> "")) { 

           $insert = query("INSERT INTO rujukan_internal_poli VALUES ('{$no_rawat}', '{$_POST['dokter_tujuan']}', '{$_POST['poli_tujuan']}')");
           if ($insert) {
 	            $insert2 = query("INSERT INTO rujukan_internal_poli_detail VALUES ('{$no_rawat}', '{$_POST['konsul']}', '', '', '')");                
                redirect("{$_SERVER['PHP_SELF']}?action=view&no_rawat={$no_rawat}");
           }
    }
  }

  ?>
<div class="row clearfix">
    <div class="col-sm-12">
        <dl class="dl-horizontal">

            <dt>Poli Tujuan</dt>
            <dd>
                <select name="poli_tujuan" class="form-control show-tick" style="width:100%" onchange="this.form.submit()">
                  <option value="">------</option>
                <?php
                $sql = query("SELECT * FROM poliklinik WHERE nm_poli LIKE 'POLI%'");
                while($row = fetch_array($sql)){
                    echo "<option value='".$row["0"]."'".($row["0"]==$_REQUEST["poli_tujuan"] ? " selected" : "").">".$row["1"]."</option>";
                }
                ?>
                </select>
            </dd><br>

			<?php if(isset($_REQUEST['poli_tujuan'])){ ?>          
            <dt>Dokter Tujuan</dt>
            <dd>
                <select name="dokter_tujuan" class="form-control show-tick" style="width:100%">
                  <option value="">------</option>
                <?php
                $sql = query("SELECT a.kd_dokter, b.nm_dokter FROM jadwal a, dokter b WHERE a.kd_poli = '".$_REQUEST['poli_tujuan']."' AND a.kd_dokter = b.kd_dokter GROUP BY a.kd_dokter");
                while($row = fetch_array($sql)){
                  	echo "<option value='".$row["0"]."'".($row["0"]==$_REQUEST["dokter_tujuan"] ? " selected" : "").">".$row["1"]."</option>";
                }
                ?>
                </select>
            </dd><br>
		    <?php } ?>
          
            <dt>Catatan Konsul</dt>
            <dd><textarea rows="8" name="konsul" class="form-control no-resize" placeholder="Tulis catatan konsul disini..."></textarea></dd><br>
            <dt></dt>
            <dd><button type="submit" name="ok_rujuk" value="ok_rujuk" class="btn bg-indigo waves-effect" onclick="this.value=\'ok_rujuk\'">SIMPAN</button></dd><br>
            <dt></dt>
        </dl>
    </div>
</div>
</form>

<dl class="dl-horizontal">
  <?php
  $data = fetch_array(query("SELECT b.nm_poli, c.nm_dokter FROM rujukan_internal_poli a, poliklinik b, dokter c WHERE a.no_rawat = '{$no_rawat}' AND a.kd_poli = b.kd_poli AND a.kd_dokter = c.kd_dokter"));
  $data1 = fetch_array(query("SELECT * FROM rujukan_internal_poli_detail WHERE no_rawat = '{$no_rawat}'"));
  ?>
   <?php if(!empty($data1['0'])) { ?> 
  <h4>Konsul / Rujukan Internal</h4>

  <dt>Poli Tujuan</dt>
  <dd><?php echo $data['0']; ?></dd><br>
  <dt>Dokter Tujuan</dt>
  <dd><?php echo $data['1']; ?></dd><br>
  <dt>Catatan Kosul</dt>
  <dd><?php echo nl2br($data1['1']); ?></dd><br>
  <?php } ?>
  <?php if(!empty($data1['saran'])) { ?>
  <h4>Jawaban Konsul</h4>
  <dt>Pemeriksaan</dt>
  <dd><?php echo $data1['2']; ?></dd><br>
  <dt>Diagnosa</dt>
  <dd><?php echo $data1['3']; ?></dd><br>
  <dt>Saran</dt>
  <dd><?php echo $data1['4']; ?></dd><br>
  <?php } ?>
</dl>

